import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'NeuroShape',
  description: 'Shape to Neural Network',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}