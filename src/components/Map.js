import React, { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import parseGeoraster from "georaster";
import GeoRasterLayer from "georaster-layer-for-leaflet";

const Map = ({setLoading}) => {
  const mapRef = useRef(null);
  const layerControlRef = useRef(null);
  const stressLayersRef = useRef([]); // Store references to stress layers
  const [status, setStatus] = useState("Loading map...");
  
  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map("map").setView([0, 0], 2);
      const baseLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapRef.current);
      
      // Initialize the layer control
      layerControlRef.current = L.control.layers(
        { "OpenStreetMap": baseLayer },
        {}
      ).addTo(mapRef.current);
    }
    
    async function loadGeoTIFF() {
      try {
        setStatus("Fetching GeoTIFF file...");
        const url = "/optimized_sample.tif";
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch GeoTIFF: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        console.log("GeoTIFF file loaded, size:", arrayBuffer.byteLength, "bytes");
        
        setStatus("Parsing GeoTIFF data...");
        const georaster = await parseGeoraster(arrayBuffer);
        console.log("GeoRaster parsed:", georaster);
        
        setStatus("Creating GeoTIFF layer...");
        const layer = new GeoRasterLayer({
          georaster,
          opacity: 0.7,
          resolution: 256,
          pixelValuesToColorFn: values => {
            const value = values[0];
            if (value === georaster.noDataValue || value == null) return null;
            
            // Visualize the base GeoTIFF in grayscale to make the stress overlay more visible
            const intensity = Math.min(255, Math.max(0, value * 255));
            return `rgba(${intensity}, ${intensity}, ${intensity}, 0.5)`;
          }
        });
        
        layer.addTo(mapRef.current);
        layerControlRef.current.addOverlay(layer, "GeoTIFF Base Layer");
        console.log("Layer added to map");
        
        const bounds = layer.getBounds();
        if (bounds && bounds.isValid()) {
          mapRef.current.fitBounds(bounds);
          setStatus("GeoTIFF displayed successfully");
        } else {
          console.warn("Invalid bounds, could not zoom map");
          setStatus("GeoTIFF loaded, but no valid bounds");
        }
        
        // Once GeoTIFF is loaded, load the stress data
        await loadStressData();
        
      } catch (error) {
        console.error("Error loading GeoTIFF:", error);
        setStatus("Error: " + error.message);
      }
    }
    
    async function loadStressData() {
      try {
        setStatus("Loading stress data...");
        const urls = ["/stress_sample.json", "/stress_sample_2.json"];
        const responses = await Promise.all(urls.map(url => fetch(url)));
        const jsonData = await Promise.all(responses.map(res => res.json()));

        // Remove previous stress layers from control
        stressLayersRef.current.forEach(layer => {
            mapRef.current.removeLayer(layer);
            layerControlRef.current.removeLayer(layer);
          });
          stressLayersRef.current = [];
        
        // Process each stress dataset
        jsonData.forEach((dataset, datasetIndex) => {
          const features = dataset.type === "FeatureCollection" ? dataset.features : [dataset];
          
          console.log(`Stress Dataset ${datasetIndex + 1} has ${features.length} features`);
          
          const stressLayer = L.geoJSON(dataset, {
            style: feature => {
              const ndviValue = feature.properties.value;
              const stressValue = Math.min(1, Math.max(0, ndviValue));
              const h = stressValue * 120; // hue (0=red, 120=green)
              
            if(ndviValue <= 0.3) {
                return {
                fillColor: `hsl(${h}, 100%, 50%)`,
                color: 'red',
                weight: 0.5,
                fillOpacity: 0.7}
            } else {
                return {
                fillColor: `hsl(${h}, 100%, 50%)`,
                color: 'green',
                weight: 0.5,
                fillOpacity: 0.7}
            }
         },
            onEachFeature: (feature, layer) => {
              const ndviValue = feature.properties.value;
              
              layer.bindPopup(`
                <b>NDVI Value:</b> ${ndviValue.toFixed(3)}<br/>
                <b>Unit:</b> ${feature.properties.unit || 'n/a'}<br/>
                <b>Dataset:</b> Stress Sample ${datasetIndex + 1}
              `);
            }
          });
          
          // Add the layer to the map but don't show both by default
          if (datasetIndex === 0) {
            stressLayer.addTo(mapRef.current);
          }
          
          // Add to layer control
          layerControlRef.current.addOverlay(stressLayer, `Stress Sample ${datasetIndex + 1}`);
          stressLayersRef.current.push(stressLayer);
        });
        
        setStatus("Stress data overlaid successfully");
        setLoading(false);
      } catch (error) {
        console.error("Error loading stress data:", error);
        setStatus("Error loading stress data: " + error.message);
      }
    }
    
    loadGeoTIFF();
    
    
    // Clean up on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    
  }, [setLoading]);
  
  return (
    <div>
      <div id="map" style={{ height: "80vh", width: "100%" }} />
      <div style={{ 
        textAlign: "center", 
        background: "white", 
        padding: "10px",
        boxShadow: "0 -2px 5px rgba(0,0,0,0.1)" 
      }}>
        <p>{status}</p>
        <div style={{ fontSize: "0.9em", marginTop: "5px" }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <span>NDVI Scale: </span>
            <div style={{ 
              width: "200px", 
              height: "20px", 
              background: "linear-gradient(to right, red, yellow, green)", 
              margin: "0 10px",
              border: "1px solid #ccc" 
            }}></div>
            <span>Low → High</span>
          </div>
          <div style={{ marginTop: "5px", fontSize: "0.8em", color: "#666" }}>
            Higher NDVI values (green) indicate healthier vegetation with less stress
          </div>
        </div>
      </div>
    </div>
  );
};

export default Map;