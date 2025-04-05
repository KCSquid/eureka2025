import * as Location from 'expo-location';
import { SetStateAction, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Home() {
  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [edgePoints, setEdgePoints] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [atPointMessage, setAtPointMessage] = useState<string | null>(null);
  const [closestDistance, setClosestDistance] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [directionToPoint, setDirectionToPoint] = useState<string | null>(null);
  const [closestPointIndex, setClosestPointIndex] = useState<number | null>(null);
  const [collectedPoints, setCollectedPoints] = useState<number>(0);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let headingSubscription: Location.LocationSubscription;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      // Subscribe to heading (compass) updates
      headingSubscription = await Location.watchHeadingAsync((headingData) => {
        setHeading(headingData.magHeading);
      });

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation, // Request highest accuracy
      });
      const coords = currentLocation.coords;
      setLocation(coords);
      setAccuracy(coords.accuracy);
      console.log(coords);

      // Calculate random points on the edges of a square boundary (5 meters)
      const earthRadius = 6371000; // Radius of Earth in meters
      const latOffset = (5 / earthRadius) * (180 / Math.PI); // 5 meters in latitude
      const lonOffset =
        (5 / (earthRadius * Math.cos((coords.latitude * Math.PI) / 180))) * (180 / Math.PI); // 5 meters in longitude

      const points: SetStateAction<string[]> = [];
      for (let i = 0; i < 7; i++) {
        const edge = Math.floor(Math.random() * 4); // Randomly pick an edge (0: top, 1: bottom, 2: left, 3: right)
        let lat, lon;
        switch (edge) {
          case 0: // Top edge
            lat = coords.latitude + latOffset;
            lon = coords.longitude + Math.random() * 2 * lonOffset - lonOffset;
            break;
          case 1: // Bottom edge
            lat = coords.latitude - latOffset;
            lon = coords.longitude + Math.random() * 2 * lonOffset - lonOffset;
            break;
          case 2: // Left edge
            lat = coords.latitude + Math.random() * 2 * latOffset - latOffset;
            lon = coords.longitude - lonOffset;
            break;
          case 3: // Right edge
            lat = coords.latitude + Math.random() * 2 * latOffset - latOffset;
            lon = coords.longitude + lonOffset;
            break;
        }
        points.push(`Latitude: ${lat}, Longitude: ${lon}`);
      }

      setEdgePoints(points);

      // Update location every 2 seconds
      intervalId = setInterval(async () => {
        const newLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation, // Request highest accuracy
        });
        const newCoords = newLocation.coords;
        setLocation(newCoords);
        setAccuracy(newCoords.accuracy);
        console.log(newCoords);

        // Check if the user is at any of the edge points
        let minDistance = Infinity;
        let nearestPointIndex = -1;
        let nearestPointCoords = { lat: 0, lon: 0 };
        let foundPointIndex = -1;

        const atPoint = points.find((point, index) => {
          const [latStr, lonStr] = point
            .replace('Latitude: ', '')
            .replace('Longitude: ', '')
            .split(', ');
          const lat = parseFloat(latStr);
          const lon = parseFloat(lonStr);

          // Calculate the distance
          const distance =
            Math.sqrt(
              Math.pow(lat - newCoords.latitude, 2) + Math.pow(lon - newCoords.longitude, 2)
            ) *
            (Math.PI / 180) *
            earthRadius;

          if (distance < minDistance) {
            minDistance = distance;
            nearestPointIndex = index;
            nearestPointCoords = { lat, lon };
          }

          // Use a larger threshold based on GPS accuracy
          // At least 3 meters or the current accuracy, whichever is larger
          const proximityThreshold = Math.max(3, newCoords.accuracy || 3);
          const isAtPoint = distance <= proximityThreshold;

          if (isAtPoint) {
            foundPointIndex = index;
          }

          return isAtPoint;
        });

        setClosestDistance(minDistance);
        setClosestPointIndex(nearestPointIndex);

        if (atPoint) {
          setAtPointMessage('Point collected!');
          setDirectionToPoint(null);
          setCollectedPoints((prev) => prev + 1);

          // Remove the point from the array
          if (foundPointIndex !== -1) {
            const newPoints = [...points];
            newPoints.splice(foundPointIndex, 1);
            setEdgePoints(newPoints);
          }

          // Clear the message after 3 seconds
          setTimeout(() => {
            setAtPointMessage(null);
          }, 3000);
        } else if (nearestPointIndex !== -1) {
          // Calculate bearing to the nearest point
          const dLon = nearestPointCoords.lon - newCoords.longitude;
          const y = Math.sin(dLon) * Math.cos(nearestPointCoords.lat);
          const x =
            Math.cos(newCoords.latitude) * Math.sin(nearestPointCoords.lat) -
            Math.sin(newCoords.latitude) * Math.cos(nearestPointCoords.lat) * Math.cos(dLon);
          let bearing = (Math.atan2(y, x) * 180) / Math.PI;
          bearing = (bearing + 360) % 360; // Normalize to 0-360

          // Get user-friendly direction
          let direction = '';
          if (heading !== null) {
            const relativeBearing = (bearing - heading + 360) % 360;

            if (relativeBearing > 337.5 || relativeBearing <= 22.5) {
              direction = 'FORWARD';
            } else if (relativeBearing > 22.5 && relativeBearing <= 67.5) {
              direction = 'FORWARD + RIGHT';
            } else if (relativeBearing > 67.5 && relativeBearing <= 112.5) {
              direction = 'RIGHT';
            } else if (relativeBearing > 112.5 && relativeBearing <= 157.5) {
              direction = 'BACK + RIGHT';
            } else if (relativeBearing > 157.5 && relativeBearing <= 202.5) {
              direction = 'BACK';
            } else if (relativeBearing > 202.5 && relativeBearing <= 247.5) {
              direction = 'BACK + LEFT';
            } else if (relativeBearing > 247.5 && relativeBearing <= 292.5) {
              direction = 'LEFT';
            } else {
              direction = 'FORWARD + LEFT';
            }
          } else {
            // Fallback if no heading is available
            direction = `${Math.round(bearing)}° (N=0°, E=90°)`;
          }

          setDirectionToPoint(`${direction} (${minDistance.toFixed(2)}m)`);
        }
      }, 2000);
    })();

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (headingSubscription) headingSubscription.remove();
    };
  }, []);

  return (
    <View style={styles.container}>
      {errorMsg ? (
        <Text>{errorMsg}</Text>
      ) : (
        <>
          <Text style={styles.headerText}>
            {location
              ? `Current Location: Latitude: ${location.latitude.toFixed(6)}, Longitude: ${location.longitude.toFixed(6)}`
              : 'Fetching location...'}
          </Text>

          {accuracy !== null && (
            <Text style={styles.accuracyText}>
              GPS Accuracy: ±{accuracy.toFixed(1)}m{' '}
              {accuracy < 5 ? '(Good)' : accuracy < 10 ? '(Fair)' : '(Poor)'}
            </Text>
          )}

          <Text style={styles.scoreText}>Points Collected: {collectedPoints}</Text>

          {heading !== null && (
            <Text style={styles.headerText}>
              Heading: {Math.round(heading)}° {getCardinalDirection(heading)}
            </Text>
          )}

          {directionToPoint && <Text style={styles.directionText}>{directionToPoint}</Text>}

          {atPointMessage && <Text style={styles.successText}>{atPointMessage}</Text>}

          <Text style={styles.sectionTitle}>Remaining Points: {edgePoints.length}</Text>

          {edgePoints.length > 0 ? (
            edgePoints.map((point, index) => (
              <Text
                key={index}
                style={[
                  styles.pointText,
                  closestPointIndex === index ? styles.highlightedPoint : null,
                ]}>
                Point {index + 1}: {point}
              </Text>
            ))
          ) : (
            <Text style={styles.successText}>All points collected! Well done!</Text>
          )}
        </>
      )}
    </View>
  );
}

// Helper function to convert heading to cardinal direction
function getCardinalDirection(angle: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(angle / 45) % 8;
  return directions[index];
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  headerText: {
    fontSize: 16,
    marginBottom: 10,
  },
  accuracyText: {
    fontSize: 16,
    marginBottom: 10,
    fontWeight: 'bold',
    color: '#777',
  },
  directionText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 15,
    color: '#0066cc',
  },
  successText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 15,
    color: 'green',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
  },
  pointText: {
    fontSize: 14,
    marginVertical: 2,
  },
  highlightedPoint: {
    fontWeight: 'bold',
    color: '#0066cc',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: 'green',
  },
});
