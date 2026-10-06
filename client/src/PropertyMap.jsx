import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

// Fix default Leaflet marker icon paths broken by bundlers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function MapRecenter({ lat, lon }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lon], 14) }, [map, lat, lon])
  return null
}

export default function PropertyMap({ address }) {
  const [coords, setCoords] = useState(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    setCoords(null); setError(false)
    if (!address) return
    let active = true
    const controller = new AbortController()
    const encoded = encodeURIComponent(address)
    const timer = setTimeout(() => {
      fetch(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`, {
        headers: { 'Accept-Language': 'en' },
        signal: controller.signal,
      })
      .then(r => {
        if (!r.ok) throw new Error('Could not look up location')
        return r.json()
      })
      .then(data => {
        if (!active) return
        const lat = Number.parseFloat(data[0]?.lat)
        const lon = Number.parseFloat(data[0]?.lon)
        if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
          setCoords({ lat, lon })
        } else {
          setError(true)
        }
      })
      .catch(() => { if (active) setError(true) })
    }, 350)
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [address])

  if (!address) return (
    <div className="w-full h-full flex items-center justify-center bg-base-200 text-muted text-sm">
      Enter an address to see the map
    </div>
  )
  if (error) return (
    <div className="w-full h-full flex items-center justify-center bg-base-200 text-muted text-sm">
      Location not found
    </div>
  )
  if (!coords) return (
    <div className="w-full h-full flex items-center justify-center bg-base-200">
      <span className="loading loading-spinner loading-md" />
    </div>
  )

  return (
    <MapContainer center={[coords.lat, coords.lon]} zoom={14}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom={true}
      zoomControl={true}
      attributionControl={true}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapRecenter lat={coords.lat} lon={coords.lon} />
      <Marker position={[coords.lat, coords.lon]}>
        <Popup>{address}</Popup>
      </Marker>
    </MapContainer>
  )
}
