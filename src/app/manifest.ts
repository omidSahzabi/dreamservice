import type {MetadataRoute} from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dream Service",
    short_name: "Dream Service",
    icons: [
      {src: "/icons/icon-192.png", sizes: "192x192", type: "image/png"},
      {src: "/icons/icon-512.png", sizes: "512x512", type: "image/png"},
      {src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable"},
    ],
    theme_color: "#06111E",
    background_color: "#06111E",
    display: "standalone",
  };
}
