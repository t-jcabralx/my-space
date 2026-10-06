import './globals.css'

export const metadata = {
  title: 'My Space Arcade',
  description: 'Space Impact: Neon, Operation Ground Zero (run & gun) and Pickleball, in one arcade.',
}
export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
