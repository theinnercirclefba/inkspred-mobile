/**
 * Dark map styling for Android (Google Maps provider). iOS uses Apple Maps,
 * which we set to dark via MapView's `userInterfaceStyle` instead, so this JSON
 * only applies on Android. Tuned to the InkSpred ink palette — near-black land,
 * muted labels, oxblood-neutral roads — so the map recedes behind the pins.
 */
import type { MapStyleElement } from "react-native-maps";

export const DARK_MAP_STYLE: MapStyleElement[] = [
  { elementType: "geometry", stylers: [{ color: "#0d0d10" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8e897d" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0d0d10" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#2a2a31" }],
  },
  {
    featureType: "administrative.country",
    elementType: "labels.text.fill",
    stylers: [{ color: "#c9c4b8" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#cfcabd" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8e897d" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#141b16" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1c1c21" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#918c7e" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#2b2b34" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#1c1c21" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#050507" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3a3a45" }],
  },
];
