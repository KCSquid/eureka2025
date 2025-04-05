import * as Location from 'expo-location';

import { useEffect, useState, useRef } from 'react';
import { View, Text } from 'react-native';
import { MapPin, Target } from 'lucide-react-native';

type ChessPiece = {
  name: string;
  symbol: string;
  color: string;
};

const chessPieces: ChessPiece[] = [
  { name: 'Queen', symbol: '♛', color: 'text-gray-800' },
  { name: 'Rook', symbol: '♜', color: 'text-gray-800' },
  { name: 'Rook', symbol: '♜', color: 'text-gray-800' },
  { name: 'Bishop', symbol: '♝', color: 'text-gray-800' },
  { name: 'Bishop', symbol: '♝', color: 'text-gray-800' },
  { name: 'Knight', symbol: '♞', color: 'text-gray-800' },
  { name: 'Knight', symbol: '♞', color: 'text-gray-800' },
];

export default function Home() {
  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [edgePoints, setEdgePoints] = useState<{ piece: ChessPiece; lat: number; lon: number }[]>(
    []
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [atPointMessage, setAtPointMessage] = useState<string | null>(null);

  const [heading, setHeading] = useState<number | null>(null);
  const [directionToPoint, setDirectionToPoint] = useState<string | null>(null);
  const [closestPointIndex, setClosestPointIndex] = useState<number | null>(null);
  const [closestDistance, setClosestDistance] = useState<number | null>(null);
  const [collectedPieces, setCollectedPieces] = useState<ChessPiece[]>([]);
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

      headingSubscription = await Location.watchHeadingAsync((headingData) => {
        setHeading(headingData.magHeading);
      });

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      const coords = currentLocation.coords;
      setLocation(coords);
      setAccuracy(coords.accuracy);

      const earthRadius = 6371000;
      const latOffset = (5 / earthRadius) * (180 / Math.PI);
      const lonOffset =
        (5 / (earthRadius * Math.cos((coords.latitude * Math.PI) / 180))) * (180 / Math.PI);

      const selectedPieces = [...chessPieces].sort(() => 0.5 - Math.random()).slice(0, 7);

      const points = selectedPieces.map((piece) => {
        const edge = Math.floor(Math.random() * 4);
        let lat: number = 0,
          lon: number = 0;
        switch (edge) {
          case 0:
            lat = coords.latitude + latOffset;
            lon = coords.longitude + Math.random() * 2 * lonOffset - lonOffset;
            break;
          case 1:
            lat = coords.latitude - latOffset;
            lon = coords.longitude + Math.random() * 2 * lonOffset - lonOffset;
            break;
          case 2:
            lat = coords.latitude + Math.random() * 2 * latOffset - latOffset;
            lon = coords.longitude - lonOffset;
            break;
          case 3:
            lat = coords.latitude + Math.random() * 2 * latOffset - latOffset;
            lon = coords.longitude + lonOffset;
            break;
        }
        return { piece, lat, lon };
      });

      setEdgePoints(
        points.filter((point) => point.lat !== undefined && point.lon !== undefined) as {
          piece: ChessPiece;
          lat: number;
          lon: number;
        }[]
      );

      intervalId = setInterval(async () => {
        const newLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });
        const newCoords = newLocation.coords;
        setLocation(newCoords);

        const currentAccuracy = newCoords.accuracy || 0;
        setAccuracy(currentAccuracy);

        const now = Date.now();
        if (currentAccuracy > 10) {
          if (poorAccuracyTimestamp.current === null) {
            poorAccuracyTimestamp.current = now;
          } else if (now - poorAccuracyTimestamp.current >= 5000) {
            setIsPlayable(false);
          }
        } else {
          poorAccuracyTimestamp.current = null;
          setIsPlayable(true);
        }

        if (isPlayable) {
          let minDistance = Infinity;
          let nearestPointIndex = -1;
          let nearestPointCoords = { lat: 0, lon: 0 };
          let foundPointIndex = -1;

          points.forEach((point, index) => {
            const distance =
              Math.sqrt(
                Math.pow((point.lat ?? 0) - newCoords.latitude, 2) +
                  Math.pow((point.lon ?? 0) - newCoords.longitude, 2)
              ) *
              (Math.PI / 180) *
              earthRadius;

            if (distance < minDistance) {
              minDistance = distance;
              nearestPointIndex = index;
              nearestPointCoords = { lat: point.lat ?? 0, lon: point.lon ?? 0 };
            }

            const proximityThreshold = Math.max(3, newCoords.accuracy || 3);
            const isAtPoint = distance <= proximityThreshold;

            if (isAtPoint) {
              foundPointIndex = index;
            }
          });
          setClosestDistance(minDistance);
          setClosestPointIndex(nearestPointIndex);

          const now = Date.now();

          if (foundPointIndex !== -1) {
            // We found a point - check if we're close enough to collect it
            const foundPointDistance =
              Math.sqrt(
                Math.pow((points[foundPointIndex].lat ?? 0) - newCoords.latitude, 2) +
                  Math.pow((points[foundPointIndex].lon ?? 0) - newCoords.longitude, 2)
              ) *
              (Math.PI / 180) *
              earthRadius;

            // Only start collecting if we're within a tighter threshold
            // This prevents false "collecting" when just passing by
            const collectionThreshold = Math.min(2, (newCoords.accuracy || 3) / 2);

            if (foundPointDistance <= collectionThreshold) {
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

                if (elapsedTime >= 5000) {
                  // Collection complete
                  const collectedPiece = points[foundPointIndex].piece;
                  setAtPointMessage(`${collectedPiece.name} collected!`);
                  setDirectionToPoint(null);
                  setCollectedPieces((prev) => [...prev, collectedPiece]);
                  setCollectingPoint(false);
                  setCollectingProgress(0);
                  collectingStartTime.current = null;
                  currentCollectingPointIndex.current = null;

                  if (foundPointIndex !== -1) {
                    const newPoints = [...points];
                    newPoints.splice(foundPointIndex, 1);
                    setEdgePoints(
                      newPoints.filter(
                        (point) => point.lat !== undefined && point.lon !== undefined
                      ) as { piece: ChessPiece; lat: number; lon: number }[]
                    );
                  }

                  setTimeout(() => {
                    setAtPointMessage(null);
                  }, 3000);
                }
              } else {
                // Different point, reset collection
                collectingStartTime.current = now;
                currentCollectingPointIndex.current = foundPointIndex;
                setCollectingProgress(0);
              }
            } else {
              // We're near a point but not close enough to collect
              // Clear any ongoing collection
              if (collectingPoint) {
                setCollectingPoint(false);
                setCollectingProgress(0);
                collectingStartTime.current = null;
                currentCollectingPointIndex.current = null;
              }

              // Ensure directionToPoint is updated even when near a point
              if (nearestPointIndex !== -1) {
                const dLon = nearestPointCoords.lon - newCoords.longitude;
                const y = Math.sin(dLon) * Math.cos(nearestPointCoords.lat);
                const x =
                  Math.cos(newCoords.latitude) * Math.sin(nearestPointCoords.lat) -
                  Math.sin(newCoords.latitude) * Math.cos(nearestPointCoords.lat) * Math.cos(dLon);
                let bearing = (Math.atan2(y, x) * 180) / Math.PI;
                bearing = (bearing + 360) % 360;

                let direction = '';
                if (heading !== null) {
                  const relativeBearing = (bearing - heading + 360) % 360;

                  // Create a more detailed direction message with exact angle
                  let directionArrow = '↑';
                  if (relativeBearing > 337.5 || relativeBearing <= 22.5) {
                    direction = 'FORWARD';
                    directionArrow = '↑';
                  } else if (relativeBearing > 22.5 && relativeBearing <= 67.5) {
                    direction = 'FORWARD-RIGHT';
                    directionArrow = '↗';
                  } else if (relativeBearing > 67.5 && relativeBearing <= 112.5) {
                    direction = 'RIGHT';
                    directionArrow = '→';
                  } else if (relativeBearing > 112.5 && relativeBearing <= 157.5) {
                    direction = 'BACK-RIGHT';
                    directionArrow = '↘';
                  } else if (relativeBearing > 157.5 && relativeBearing <= 202.5) {
                    direction = 'BACK';
                    directionArrow = '↓';
                  } else if (relativeBearing > 202.5 && relativeBearing <= 247.5) {
                    direction = 'BACK-LEFT';
                    directionArrow = '↙';
                  } else if (relativeBearing > 247.5 && relativeBearing <= 292.5) {
                    direction = 'LEFT';
                    directionArrow = '←';
                  } else {
                    direction = 'FORWARD-LEFT';
                    directionArrow = '↖';
                  }

                  // Calculate how many degrees to turn
                  let turnDegrees = Math.round(relativeBearing);
                  if (turnDegrees > 180) {
                    turnDegrees = 360 - turnDegrees;
                    direction = direction.replace('RIGHT', 'LEFT').replace('LEFT', 'RIGHT');
                  }

                  const nextPiece = points[nearestPointIndex].piece;
                  setDirectionToPoint(
                    `${nextPiece.symbol} ${directionArrow} ${direction} (${minDistance.toFixed(1)}m)\nTurn ${turnDegrees}° to find the ${nextPiece.name}`
                  );
                } else {
                  // Fallback if no heading is available
                  direction = `${Math.round(bearing)}° from North`;

                  const nextPiece = points[nearestPointIndex].piece;
                  setDirectionToPoint(
                    `${nextPiece.symbol} Head ${direction} for ${minDistance.toFixed(1)}m\nFind the ${nextPiece.name}`
                  );
                }
              }
            }
          } else {
            // Not at any point, clear collection state
            if (collectingPoint) {
              setCollectingPoint(false);
              setCollectingProgress(0);
              collectingStartTime.current = null;
              currentCollectingPointIndex.current = null;
            }

            if (nearestPointIndex !== -1) {
              const dLon = nearestPointCoords.lon - newCoords.longitude;
              const y = Math.sin(dLon) * Math.cos(nearestPointCoords.lat);
              const x =
                Math.cos(newCoords.latitude) * Math.sin(nearestPointCoords.lat) -
                Math.sin(newCoords.latitude) * Math.cos(nearestPointCoords.lat) * Math.cos(dLon);
              let bearing = (Math.atan2(y, x) * 180) / Math.PI;
              bearing = (bearing + 360) % 360;

              let direction = '';
              if (heading !== null) {
                const relativeBearing = (bearing - heading + 360) % 360;

                // Create a more detailed direction message with exact angle
                let directionArrow = '↑';
                if (relativeBearing > 337.5 || relativeBearing <= 22.5) {
                  direction = 'FORWARD';
                  directionArrow = '↑';
                } else if (relativeBearing > 22.5 && relativeBearing <= 67.5) {
                  direction = 'FORWARD-RIGHT';
                  directionArrow = '↗';
                } else if (relativeBearing > 67.5 && relativeBearing <= 112.5) {
                  direction = 'RIGHT';
                  directionArrow = '→';
                } else if (relativeBearing > 112.5 && relativeBearing <= 157.5) {
                  direction = 'BACK-RIGHT';
                  directionArrow = '↘';
                } else if (relativeBearing > 157.5 && relativeBearing <= 202.5) {
                  direction = 'BACK';
                  directionArrow = '↓';
                } else if (relativeBearing > 202.5 && relativeBearing <= 247.5) {
                  direction = 'BACK-LEFT';
                  directionArrow = '↙';
                } else if (relativeBearing > 247.5 && relativeBearing <= 292.5) {
                  direction = 'LEFT';
                  directionArrow = '←';
                } else {
                  direction = 'FORWARD-LEFT';
                  directionArrow = '↖';
                }

                // Calculate how many degrees to turn
                let turnDegrees = Math.round(relativeBearing);
                if (turnDegrees > 180) {
                  turnDegrees = 360 - turnDegrees;
                  direction = direction.replace('RIGHT', 'LEFT').replace('LEFT', 'RIGHT');
                }

                const nextPiece = points[nearestPointIndex].piece;
                setDirectionToPoint(
                  `${directionArrow} ${direction} (${minDistance.toFixed(1)}m)\nTurn ${turnDegrees}° to find the ${nextPiece.name}`
                );
              } else {
                // Fallback if no heading is available
                direction = `${Math.round(bearing)}° from North`;

                const nextPiece = points[nearestPointIndex].piece;
                setDirectionToPoint(
                  `${nextPiece.symbol} Head ${direction} for ${minDistance.toFixed(1)}m\nFind the ${nextPiece.name}`
                );
              }
            }
          }
        }
      }, 500);
    })();

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (headingSubscription) headingSubscription.remove();
    };
  }, [isPlayable]);

  if (errorMsg) {
    return (
      <View className="p-5">
        <Text className="font-bricolage-bold mb-4 text-center text-lg text-red-600">
          {errorMsg}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex flex-col items-center justify-center gap-4 p-5">
      <View className="flex w-full items-center justify-center gap-2">
        <Text className="font-bricolage-bold mb-2.5 text-3xl text-violet-700">Chess Quest</Text>

        <View className="flex flex-row gap-2">
          <View className="flex flex-row items-center justify-center gap-2 rounded-sm bg-violet-200 p-2">
            <MapPin color={'#000'} />
            <Text className="font-inter-bold">
              {location
                ? `(${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)})`
                : 'Fetching location...'}
            </Text>
          </View>
          <View className="flex flex-row items-center justify-center gap-2 rounded-sm bg-violet-200 p-2">
            <Target color={'#000'} />
            {accuracy && (
              <Text className="font-inter-bold">
                ±{accuracy.toFixed(1)}m{' '}
                {accuracy < 5 ? '(Good)' : accuracy < 10 ? '(Fair)' : '(Poor)'}
              </Text>
            )}
          </View>
        </View>
      </View>

      <View className="mb-4 rounded-lg bg-gray-100 p-3">
        <Text className="font-bricolage-bold mb-2 text-lg text-green-700">
          Your Collection: {collectedPieces.length}/7
        </Text>
        <View className="flex-row flex-wrap justify-center">
          {collectedPieces.map((piece, idx) => (
            <Text key={idx} className="font-bricolage m-1 text-4xl">
              {piece.symbol}
            </Text>
          ))}
          {Array(7 - collectedPieces.length)
            .fill(0)
            .map((_, idx) => (
              <Text key={idx} className="font-bricolage m-1 text-4xl text-gray-300">
                ?
              </Text>
            ))}
        </View>
      </View>

      {heading !== null && (
        <Text className="font-inter mb-2.5 text-base">
          Heading: {Math.round(heading)}° {getCardinalDirection(heading)}
        </Text>
      )}

      {collectingPoint && (
        <View className="relative my-4 h-10 w-full overflow-hidden rounded-3xl bg-gray-300">
          <View
            className="h-full rounded-3xl bg-green-500"
            style={{ width: `${collectingProgress}%` }}
          />
          <Text className="font-inter-bold absolute inset-0 py-2.5 text-center text-base text-black">
            Stay still! Collecting{' '}
            {edgePoints[currentCollectingPointIndex.current || 0]?.piece.name || 'piece'}...{' '}
            {Math.round(collectingProgress)}%
          </Text>
        </View>
      )}

      {directionToPoint && !collectingPoint && (
        <View className="my-4 rounded-lg bg-blue-100 p-3">
          <Text className="font-bricolage-bold text-2xl text-blue-700">
            {directionToPoint.split('\n')[0]}
          </Text>
          <Text className="font-inter mt-1 text-lg text-blue-600">
            {directionToPoint.split('\n')[1]}
          </Text>
        </View>
      )}

      {atPointMessage && (
        <Text className="font-bricolage-bold my-4 text-2xl text-green-700">{atPointMessage}</Text>
      )}

      <Text className="font-bricolage-bold mb-1 mt-4 text-lg">
        Remaining Pieces: {edgePoints.length}
      </Text>

      <View className="flex flex-row flex-wrap items-center justify-center">
        {edgePoints.length > 0 ? (
          edgePoints.map((point, index) => (
            <Text
              key={index}
              className={`font-inter mx-10 flex basis-20 items-center justify-center rounded-sm p-1 py-3 text-center text-4xl ${closestPointIndex === index ? ' bg-blue-200 ' : ''}`}>
              {point.piece.symbol}
            </Text>
          ))
        ) : (
          <Text className="font-bricolage-bold my-4 text-2xl text-green-700">
            All pieces collected! Your chess set is complete!
          </Text>
        )}
      </View>
    </View>
  );
}

function getCardinalDirection(angle: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(angle / 45) % 8;
  return directions[index];
}
