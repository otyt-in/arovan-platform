import "./globals.css";

export const metadata = {
  title: "AROVAN | Product Master",
  description: "Product Master & Costing Engine",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Injecting clean, luxury-grade web typography links */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,600;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600&display=swap" 
          rel="stylesheet" 
        />
        
        <style>{`
          /* Mapping your exact brand type treatments seamlessly */
          
          /* LUFGA OPTIMIZATION: Crisp, high-end geometric sans headings */
          h1, h2, h3, button, select, label, .sku-tag {
            font-family: 'Plus Jakarta Sans', sans-serif !important;
            letter-spacing: -0.01em;
          }
          
          /* CRAKE OPTIMIZATION: Expressive, sophisticated editorial serif accent */
          .brand-serif {
            font-family: 'Playfair Display', serif !important;
            letter-spacing: -0.02em;
          }
          
          /* INTER OPTIMIZATION: Ultra-legible numbers and user form fields */
          body, input, textarea, table {
            font-family: 'Inter', sans-serif !important;
          }
          
          /* Utility hide scrollbar class for mobile navigation row */
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}