'use client';

import { useState, useEffect } from 'react';
import { Item } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const [errorReportUrl, setErrorReportUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await fetch('/api/items');
      if (response.ok) {
        const data = await response.json();
        setItems(Array.isArray(data) ? data : []);
      } else {
        setItems([]);
      }
    } catch (error) {
      setItems([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await fetch(`/api/items/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      setEditingId(null);
    } else {
      await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
    }
    setName('');
    setDescription('');
    fetchItems();
  };

  const handleEdit = (item: Item) => {
    setName(item.name);
    setDescription(item.description || '');
    setEditingId(item.id!);
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/items/${id}`, { method: 'DELETE' });
    fetchItems();
  };

  const handleFileUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setUploadMessage('');
    setErrorReportUrl('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload-items', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        setUploadMessage(data.message);
        if (data.error_report_url) {
          setErrorReportUrl(data.error_report_url.replace('/reports/', '/api/reports/'));
        }
        fetchItems(); // Refresh the list
      } else {
        setUploadMessage(data.detail || 'Upload failed');
      }
    } catch (error) {
      setUploadMessage('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">CRUD Items</h1>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{editingId ? 'Edit Item' : 'Add Item'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              type="text"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button type="submit">{editingId ? 'Update' : 'Add'}</Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={() => { setEditingId(null); setName(''); setDescription(''); }}>
                Cancel
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Upload Items from File</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <Button onClick={handleFileUpload} disabled={!file || isUploading}>
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
            {uploadMessage && (
              <p className="text-sm text-gray-600">{uploadMessage}</p>
            )}
            {errorReportUrl && (
              <div className="flex items-center space-x-2">
                <p className="text-sm text-red-600">Errors occurred. Download report:</p>
                <Button variant="outline" onClick={() => window.open(errorReportUrl)}>
                  Download Error Report
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex justify-between items-center p-4">
              <div>
                <h3 className="font-semibold">{item.name}</h3>
                <p>{item.description}</p>
              </div>
              <div className="space-x-2">
                <Button onClick={() => handleEdit(item)}>Edit</Button>
                <Button variant="destructive" onClick={() => handleDelete(item.id!)}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
