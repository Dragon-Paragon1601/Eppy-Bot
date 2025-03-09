import Navbar from "@/components/Navbar";
import "./globals.css"; // Upewnij się, że Tailwind działa

export default function RootLayout({ children }) {
  return (
    <html lang="pl">
      <body className="bg-gray-100">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
