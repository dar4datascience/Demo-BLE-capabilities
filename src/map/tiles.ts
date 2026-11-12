/**
 * Basemap layers, bottom to top. Esri Dark Gray Canvas — free raster tiles,
 * no API key. Note Esri's {z}/{y}/{x} order — row before column.
 * Kept Leaflet-free so both mapService and e2e tests can import it.
 */
export const MAP_TILE_LAYERS = [
  {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 16,
      attribution:
        'Tiles &copy; Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    },
  },
  {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    options: { maxZoom: 16 },
  },
] as const
