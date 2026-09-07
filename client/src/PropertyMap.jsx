import { useEffect, useRef, useState } from 'react'
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
  useEffect(() => { map.setView([lat, lon], 14) }, [lat, lon])
  return null
}

export default function PropertyMap({ address }) {
  const [coords, setCoords] = useState(null)
  const [error, setError] = useState(false)
  const prevAddress = useRef(null)

  useEffect(() => {
    if (!address || address === prevAddress.current) return
    prevAddress.current = address
    setCoords(null); setError(false)
    const encoded = encodeURIComponent(address)
    fetch(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'CREPortal/1.0' }
    })
      .then(r => r.json())
      .then(data => {
        if (data.length > 0) {
          setCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) })
        } else {
          setError(true)
        }
      })
      .catch(() => setError(true))
  }, [address])

  if (!address) return (
    <div className="w-full h-full flex items-center justify-center bg-base-200 text-base-content/30 text-sm">
      Enter an address to see the map
    </div>
  )
  if (error) return (
    <div className="w-full h-full flex items-center justify-center bg-base-200 text-base-content/30 text-sm">
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
