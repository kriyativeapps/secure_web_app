import https from 'https';
import fs from 'fs';
import path from 'path';

// Resolve and check certificate paths
const clientCertPath = path.resolve(process.cwd(), process.env.CLIENT_CERT!);
const clientKeyPath = path.resolve(process.cwd(), process.env.CLIENT_KEY!);
const caCertPath = path.resolve(process.cwd(), process.env.CA_CERT!);

if (!fs.existsSync(clientCertPath)) {
  throw new Error(`Client cert file not found: ${clientCertPath}`);
}
if (!fs.existsSync(clientKeyPath)) {
  throw new Error(`Client key file not found: ${clientKeyPath}`);
}
if (!fs.existsSync(caCertPath)) {
  throw new Error(`CA cert file not found: ${caCertPath}`);
}

const agent = new https.Agent({
  cert: fs.readFileSync(clientCertPath),
  key: fs.readFileSync(clientKeyPath),
  ca: fs.readFileSync(caCertPath),
  rejectUnauthorized: false, // Allow self-signed certs for testing
});

export { agent };