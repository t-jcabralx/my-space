/** @type {import('next').NextConfig} */
// allowedDevOrigins lets friends open `npm run dev` through a tunnel or your LAN address (dev server blocks other origins by default)
const nextConfig = { reactStrictMode: false, allowedDevOrigins: ['*.trycloudflare.com', '*.loca.lt', '*.ngrok-free.app', '*.ngrok-free.dev', '*.ngrok.app', '*.ngrok.io', '*.vercel.app', '192.168.*.*', '10.*.*.*', '172.16.*.*'] }
export default nextConfig
