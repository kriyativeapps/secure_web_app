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

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    const response = await fetch('/api/items');
    const data = await response.json();
    setItems(data);
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
