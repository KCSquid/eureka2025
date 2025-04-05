import * as Location from 'expo-location';
import { SetStateAction, useEffect, useState, useRef } from 'react';
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
  const [isPlayable, setIsPlayable] = useState<boolean>(true);
  const poorAccuracyTimestamp = useRef<number | null>(null);
  const [collectingPoint, setCollectingPoint] = useState<boolean>(false);
  const [collectingProgress, setCollectingProgress] = useState<number>(0);
  const collectingStartTime = useRef<number | null>(null);
  const currentCollectingPointIndex = useRef<number | null>(null);

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

        // Handle accuracy tracking with time threshold
        const currentAccuracy = newCoords.accuracy || 0;
        setAccuracy(currentAccuracy);

        const now = Date.now();
        if (currentAccuracy > 10) {
          // Poor accuracy detected
          if (poorAccuracyTimestamp.current === null) {
            // Start tracking poor accuracy time
            poorAccuracyTimestamp.current = now;
          } else if (now - poorAccuracyTimestamp.current >= 5000) {
            // Poor accuracy for more than 5 seconds
            setIsPlayable(false);
          }
        } else {
          // Good accuracy, reset the tracking
          poorAccuracyTimestamp.current = null;
          setIsPlayable(true);
        }

        console.log(newCoords);

        // Only process location if the game is playable
        if (isPlayable) {
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

          const now = Date.now();

          if (atPoint) {
            // User is at a point
            if (!collectingPoint) {
              // Start collecting the point
              setCollectingPoint(true);
              collectingStartTime.current = now;
              currentCollectingPointIndex.current = foundPointIndex;
              setCollectingProgress(0);
            } else if (
              foundPointIndex === currentCollectingPointIndex.current &&
              collectingStartTime.current
            ) {
              // Continue collecting the same point
              const elapsedTime = now - collectingStartTime.current;
              const progress = Math.min(100, (elapsedTime / 5000) * 100);
              setCollectingProgress(progress);

              // Check if we've reached 5 seconds
              if (elapsedTime >= 5000) {
                // Point collection complete
                setAtPointMessage('Point collected!');
                setDirectionToPoint(null);
                setCollectedPoints((prev) => prev + 1);
                setCollectingPoint(false);
                setCollectingProgress(0);
                collectingStartTime.current = null;
                currentCollectingPointIndex.current = null;

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
              }
            } else {
              // User moved to a different point, reset collection
              collectingStartTime.current = now;
              currentCollectingPointIndex.current = foundPointIndex;
              setCollectingProgress(0);
            }
          } else {
            // User is not at any point, reset collection
            if (collectingPoint) {
              setCollectingPoint(false);
              setCollectingProgress(0);
              collectingStartTime.current = null;
              currentCollectingPointIndex.current = null;
            }

            if (nearestPointIndex !== -1) {
              // Show direction to nearest point
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
          }
        }
      }, 500); // More frequent updates for smoother progress tracking
    })();

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (headingSubscription) headingSubscription.remove();
    };
  }, [isPlayable]);

  // if (!isPlayable && accuracy !== null) {
  //   return (
  //     <View style={styles.container}>
  //       <Text style={styles.errorText}>GPS accuracy is too low (±{accuracy.toFixed(1)}m).</Text>
  //       <Text style={styles.instructionText}>
  //         Please go outside or to an open area to improve GPS reception.
  //       </Text>
  //       <Text style={styles.instructionText}>
  //         The game will resume automatically when accuracy improves.
  //       </Text>
  //     </View>
  //   );
  // }

  // if (accuracy > 10) {
  //   return (
  //     <View style={styles.container}>
  //       <Text style={styles.successText}>
  //         GPS accuracy is too low. Please go outside to improve accuracy and play the game!
  //       </Text>
  //     </View>
  //   );
  // }

  return (
    <View style={styles.container}>
      {errorMsg ? (
        <Text style={styles.errorText}>{errorMsg}</Text>
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

          {collectingPoint && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${collectingProgress}%` }]} />
              <Text style={styles.progressText}>
                Collecting point... {Math.round(collectingProgress)}%
              </Text>
            </View>
          )}

          {directionToPoint && !collectingPoint && (
            <Text style={styles.directionText}>{directionToPoint}</Text>
          )}

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
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'red',
    marginBottom: 15,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  progressContainer: {
    height: 40,
    width: '100%',
    backgroundColor: '#e0e0e0',
    borderRadius: 20,
    marginVertical: 15,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 20,
  },
  progressText: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    padding: 10,
  },
});
