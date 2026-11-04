import './globals.css';

export const metadata = {
  title: { default: 'Donyi Polo Vidya Niketan, Pasighat', template: '%s | Donyi Polo Vidya Niketan' },
  description: 'CBSE school in Pasighat, East Siang, Arunachal Pradesh, teaching LKG to Class X.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" >
      <body className="bg-white font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
