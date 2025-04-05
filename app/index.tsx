import * as Location from 'expo-location';
import { SetStateAction, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { Link } from 'expo-router';
import { Chess, Square as ChessSquare } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { Camera } from 'expo-camera';
import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs';
import { ExerciseDetector } from './utils/exerciseDetection';

// Exercise types
type Exercise = 'pushups' | 'situps' | 'squats' | 'jumpingjacks';
type ExerciseStatus = 'waiting' | 'in_progress' | 'completed';

const ChessGame = () => {
  const [game, setGame] = useState<Chess | null>(null);
  const [fen, setFen] = useState<string>('');
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [currentExercise, setCurrentExercise] = useState<Exercise>('pushups');
  const [exerciseStatus, setExerciseStatus] = useState<ExerciseStatus>('waiting');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [detector, setDetector] = useState<poseDetection.PoseDetector | null>(null);
  const [exerciseDetector, setExerciseDetector] = useState<ExerciseDetector | null>(null);
  const cameraRef = useRef<any>(null);
  const [isTfReady, setIsTfReady] = useState(false);

  useEffect(() => {
    // Initialize TensorFlow.js
    const initTf = async () => {
      await tf.ready();
      setIsTfReady(true);
    };
    initTf();
  }, []);

  useEffect(() => {
    console.log('Initializing chess game...');
    if (!isTfReady) return;

    // Initialize chess game
    const newGame = new Chess();
    // Set up the initial position
    newGame.load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    setGame(newGame);
    setFen(newGame.fen());
    console.log('Chess game initialized with FEN:', newGame.fen());

    // Initialize camera permissions and pose detector
    (async () => {
      console.log('Initializing camera and pose detector...');
      if (Platform.OS === 'web') {
        console.log('Running on web platform');
        // For web, we'll use a mock permission
        setHasPermission(true);
      } else {
        try {
          console.log('Requesting camera permissions...');
          const { status } = await Camera.requestCameraPermissionsAsync();
          console.log('Camera permission status:', status);
          setHasPermission(status === 'granted');
        } catch (error) {
          console.error('Error requesting camera permissions:', error);
          setHasPermission(false);
        }
      }
      
      // Initialize pose detector
      console.log('Initializing pose detector...');
      const model = poseDetection.SupportedModels.MoveNet;
      const detector = await poseDetection.createDetector(model);
      console.log('Pose detector initialized');
      setDetector(detector);
    })();
  }, [isTfReady]);

  useEffect(() => {
    console.log('Exercise detector dependencies changed:', {
      detector: !!detector,
      cameraRef: !!cameraRef.current,
      hasPermission,
      currentExercise
    });
    
    if (detector && cameraRef.current && hasPermission) {
      console.log('Creating new exercise detector...');
      const newExerciseDetector = new ExerciseDetector(detector, currentExercise);
      newExerciseDetector.setCamera(cameraRef.current);
      setExerciseDetector(newExerciseDetector);
      console.log('Exercise detector created and set');
    }
  }, [detector, currentExercise, hasPermission]);

  const onDrop = (sourceSquare: ChessSquare, targetSquare: ChessSquare) => {
    console.log('Piece dropped:', { sourceSquare, targetSquare });
    if (!game) return false;

    // Show exercise modal before making a move
    console.log('Showing exercise modal...');
    setShowExerciseModal(true);
    setExerciseStatus('waiting');
    setCurrentExercise(getRandomExercise());
    console.log('Exercise modal shown with exercise:', currentExercise);
    
    // Start exercise detection
    (async () => {
      if (!exerciseDetector) {
        console.log('No exercise detector available');
        return;
      }

      const checkExercise = async () => {
        if (exerciseStatus === 'completed') {
          console.log('Exercise completed, making chess move...');
          try {
            const move = game.move({
              from: sourceSquare,
              to: targetSquare,
              promotion: 'q',
            });

            if (move === null) {
              console.log('Invalid move');
              return;
            }
            
            console.log('Move made:', move);
            setFen(game.fen());
            setShowExerciseModal(false);
          } catch (e) {
            console.error('Invalid move:', e);
          }
        } else {
          console.log('Checking exercise completion...');
          const isComplete = await exerciseDetector.detectExercise();
          if (isComplete) {
            console.log('Exercise detected as complete');
            setExerciseStatus('completed');
          } else {
            console.log('Exercise not complete yet');
            setTimeout(checkExercise, 100);
          }
        }
      };
      checkExercise();
    })();

    return true;
  };

  const startExercise = () => {
    console.log('Starting exercise...');
    setExerciseStatus('in_progress');
    console.log('Exercise status set to in_progress');
  };

  const getRandomExercise = (): Exercise => {
    const exercises: Exercise[] = ['pushups', 'situps', 'squats', 'jumpingjacks'];
    const exercise = exercises[Math.floor(Math.random() * exercises.length)];
    console.log('Selected random exercise:', exercise);
    return exercise;
  };

  if (!isTfReady) {
    return (
      <View style={styles.container}>
        <Text>Initializing TensorFlow.js...</Text>
      </View>
    );
  }

  return (
    <View style={styles.chessContainer}>
      <Text style={styles.chessTitle}>Chess with Exercise</Text>
      <View style={styles.boardContainer}>
        <Chessboard
          position={fen}
          onPieceDrop={onDrop}
          boardWidth={350}
          customBoardStyle={{
            borderRadius: '4px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
          }}
          customPieces={{
            wP: ({ squareWidth }) => (
              <View style={[styles.piece, { width: squareWidth, height: squareWidth }]}>
                <Text style={styles.pieceText}>♙</Text>
              </View>
            ),
            wN: ({ squareWidth }) => (
              <View style={[styles.piece, { width: squareWidth, height: squareWidth }]}>
                <Text style={styles.pieceText}>♘</Text>
              </View>
            ),
            wB: ({ squareWidth }) => (
              <View style={[styles.piece, { width: squareWidth, height: squareWidth }]}>
                <Text style={styles.pieceText}>♗</Text>
              </View>
            ),
            wR: ({ squareWidth }) => (
              <View style={[styles.piece, { width: squareWidth, height: squareWidth }]}>
                <Text style={styles.pieceText}>♖</Text>
              </View>
            ),
            wQ: ({ squareWidth }) => (
              <View style={[styles.piece, { width: squareWidth, height: squareWidth }]}>
                <Text style={styles.pieceText}>♕</Text>
              </View>
            ),
            wK: ({ squareWidth }) => (
              <View style={[styles.piece, { width: squareWidth, height: squareWidth }]}>
                <Text style={styles.pieceText}>♔</Text>
              </View>
            ),
            bP: ({ squareWidth }) => (
              <View style={[styles.piece, { width: squareWidth, height: squareWidth }]}>
                <Text style={[styles.pieceText, styles.blackPiece]}>♟</Text>
              </View>
            ),
            bN: ({ squareWidth }) => (
              <View style={[styles.piece, { width: squareWidth, height: squareWidth }]}>
                <Text style={[styles.pieceText, styles.blackPiece]}>♞</Text>
              </View>
            ),
            bB: ({ squareWidth }) => (
              <View style={[styles.piece, { width: squareWidth, height: squareWidth }]}>
                <Text style={[styles.pieceText, styles.blackPiece]}>♝</Text>
              </View>
            ),
            bR: ({ squareWidth }) => (
              <View style={[styles.piece, { width: squareWidth, height: squareWidth }]}>
                <Text style={[styles.pieceText, styles.blackPiece]}>♜</Text>
              </View>
            ),
            bQ: ({ squareWidth }) => (
              <View style={[styles.piece, { width: squareWidth, height: squareWidth }]}>
                <Text style={[styles.pieceText, styles.blackPiece]}>♛</Text>
              </View>
            ),
            bK: ({ squareWidth }) => (
              <View style={[styles.piece, { width: squareWidth, height: squareWidth }]}>
                <Text style={[styles.pieceText, styles.blackPiece]}>♚</Text>
              </View>
            ),
          }}
        />
      </View>

      <Modal
        visible={showExerciseModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          console.log('Modal closed');
          setShowExerciseModal(false);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.exerciseTitle}>
              Complete {currentExercise} to make your move!
            </Text>
            {exerciseStatus === 'waiting' && (
              <TouchableOpacity
                style={styles.startButton}
                onPress={startExercise}
              >
                <Text style={styles.startButtonText}>Start Exercise</Text>
              </TouchableOpacity>
            )}
            {exerciseStatus === 'in_progress' && (
              <View style={styles.cameraContainer}>
                <View style={styles.mockCamera}>
                  <Text style={styles.exerciseStatus}>Exercise in progress...</Text>
                  <Text style={styles.exerciseInstructions}>
                    {currentExercise === 'pushups' && 'Do 5 pushups with proper form'}
                    {currentExercise === 'situps' && 'Do 5 situps with proper form'}
                    {currentExercise === 'squats' && 'Do 5 squats with proper form'}
                    {currentExercise === 'jumpingjacks' && 'Do 5 jumping jacks'}
                  </Text>
                  <TouchableOpacity
                    style={styles.completeButton}
                    onPress={() => {
                      console.log('Complete exercise button pressed');
                      setExerciseStatus('completed');
                      // Automatically complete the exercise after 2 seconds
                      setTimeout(() => {
                        console.log('Closing exercise modal');
                        setShowExerciseModal(false);
                      }, 2000);
                    }}
                  >
                    <Text style={styles.completeButtonText}>Complete Exercise</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

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
      if (Platform.OS === 'web') {
        // For web, we'll use mock location data
        setLocation({
          latitude: 37.7749,
          longitude: -122.4194,
          altitude: null,
          accuracy: 5,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        });
        setAccuracy(5);
        setHeading(0);
        return;
      }

      try {
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
          accuracy: Location.Accuracy.BestForNavigation,
        });
        const coords = currentLocation.coords;
        setLocation(coords);
        setAccuracy(coords.accuracy);

        // Calculate random points on the edges of a square boundary (5 meters)
        const earthRadius = 6371000;
        const latOffset = (5 / earthRadius) * (180 / Math.PI);
        const lonOffset =
          (5 / (earthRadius * Math.cos((coords.latitude * Math.PI) / 180))) * (180 / Math.PI);

        const points: SetStateAction<string[]> = [];
        for (let i = 0; i < 7; i++) {
          const edge = Math.floor(Math.random() * 4);
          let lat, lon;
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
          points.push(`Latitude: ${lat}, Longitude: ${lon}`);
        }

        setEdgePoints(points);

        // Update location every 2 seconds
        intervalId = setInterval(async () => {
          const newLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
          });
          const newCoords = newLocation.coords;
          setLocation(newCoords);
          setAccuracy(newCoords.accuracy);

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
      } catch (error) {
        console.error('Error getting location:', error);
        setErrorMsg('Error getting location');
      }
    })();

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (headingSubscription) headingSubscription.remove();
    };
  }, []);

  return (
    <View style={styles.container}>
      <ChessGame />
      <Link href="/chess" asChild>
        <TouchableOpacity style={styles.chessButton}>
          <Text style={styles.chessButtonText}>Play Chess 960</Text>
        </TouchableOpacity>
      </Link>
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
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  chessButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  chessButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
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
  chessContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  chessTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  boardContainer: {
    marginBottom: 20,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    width: '80%',
  },
  exerciseTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cameraContainer: {
    width: '100%',
    aspectRatio: 3/4,
    overflow: 'hidden',
    borderRadius: 10,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseStatus: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  exerciseInstructions: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  mockCamera: {
    width: '100%',
    height: 300,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    padding: 20,
  },
  completeButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    width: '80%',
    alignItems: 'center',
  },
  completeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  piece: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pieceText: {
    fontSize: 30,
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  blackPiece: {
    color: 'black',
  },
});
