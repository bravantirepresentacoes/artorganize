import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({plugins:[react(),VitePWA({registerType:'prompt',includeAssets:['artorganiz-icon.svg'],manifest:{name:'ArtOrganiz',short_name:'ArtOrganiz',description:'Sua central pessoal de organização e finanças',theme_color:'#183d35',background_color:'#f4f6f3',display:'standalone',start_url:'/',scope:'/',icons:[{src:'/artorganiz-icon-192.png',sizes:'192x192',type:'image/png'},{src:'/artorganiz-icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]},workbox:{navigateFallback:'index.html',cleanupOutdatedCaches:true}})]})
