import { Chess, Square } from 'chess.js';
import { Link } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Button, ScrollView, Dimensions, SafeAreaView, TextInput, Alert, ActivityIndicator, Platform } from 'react-native';
import Constants from 'expo-constants';

import ChessBoard from '../components/chessboard';

export default function ChessGame() {
  const [chess] = useState(new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [history, setHistory] = useState<string[]>([]);
  const [currentTurn, setCurrentTurn] = useState<'white' | 'black'>('white');
  const [gameStatus, setGameStatus] = useState<string>('');
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [gameId, setGameId] = useState('');
  const [tempGameId, setTempGameId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [playersConnected, setPlayersConnected] = useState(0);
  const [showCreateGame, setShowCreateGame] = useState(false);
  const [isMyTurn, setIsMyTurn] = useState(true);
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [serverUrl, setServerUrl] = useState('');
  const [showServerUrlInput, setShowServerUrlInput] = useState(false);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const boardSize = Math.min(Dimensions.get('window').width - 32, 350);
  
  // Determine default server URL based on environment
  useEffect(() => {
    // Default API URL based on platform
    let defaultUrl = 'http://192.168.80.86:3000';
    
    if (Platform.OS === 'android') {
      // Android emulator uses 10.0.2.2 to access host
      defaultUrl = 'http://192.168.80.86:3000';
    } else if (Platform.OS === 'ios') {
      // iOS simulator can use localhost
      defaultUrl = 'http://192.168.80.86:3000';
    }
    
    setServerUrl(defaultUrl);
  }, []);

  useEffect(() => {
    // Clean up polling on component unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isConnected && gameId) {
      startPolling();
    }
  }, [isConnected, gameId]);

  useEffect(() => {
    checkGameStatus();
  }, [fen]);

  const createGame = () => {
    if (!serverUrl.trim()) {
      Alert.alert('Error', 'Please enter a valid server URL');
      return;
    }

    // Ensure gameId is always prefixed with "game-"
    const newGameId = `game-${Date.now()}`;
    setTempGameId(newGameId);
    setShowCreateGame(true);
  };

  const joinGame = async () => {
    if (!tempGameId.trim()) {
      Alert.alert('Error', 'Please enter a game ID');
      return;
    }

    if (!serverUrl.trim()) {
      Alert.alert('Error', 'Please enter a valid server URL');
      return;
    }

    // Ensure gameId is always prefixed with "game-" if not already
    const formattedGameId = tempGameId.startsWith('game-') ? tempGameId : `game-${tempGameId}`;

    setIsConnecting(true);
    try {
      const response = await fetch(`${serverUrl}/api/joinGame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gameId: formattedGameId }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Error', data.error || 'Failed to join game');
        setIsConnecting(false);
        return;
      }

      setGameId(formattedGameId);
      setPlayersConnected(data.playersConnected);

      if (data.status === 'waiting') {
        setWaitingForOpponent(true);
        setPlayerColor('white'); // First player is white
        setIsMyTurn(true);
      } else if (data.status === 'ready') {
        setWaitingForOpponent(false);
        setIsConnected(true);
        setPlayerColor('black'); // Second player is black
        setIsMyTurn(false);

        // Load the current game state
        if (data.fen) {
          chess.load(data.fen);
          setFen(data.fen);
          setHistory(chess.history());
          setCurrentTurn(chess.turn() === 'w' ? 'white' : 'black');
        }
      }

      setShowCreateGame(false);
      setIsConnecting(false);
    } catch (error) {
      console.error('Error joining game:', error);
      Alert.alert(
        'Connection Error',
        `Failed to connect to the server at ${serverUrl}. Please check the URL and ensure the server is running.`
      );
      setIsConnecting(false);
    }
  };

  const startPolling = () => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Set up new polling interval
    pollingIntervalRef.current = setInterval(fetchGameUpdates, 1000);
  };

  const fetchGameUpdates = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/game/${gameId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch game updates');
        return;
      }

      const data = await response.json();
      
      // Update players connected
      setPlayersConnected(data.playersConnected);
      
      // If was waiting for opponent and now 2 players, update status
      if (waitingForOpponent && data.playersConnected === 2) {
        setWaitingForOpponent(false);
        setIsConnected(true);
      }

      // Only update if the server has a newer state
      if (data.fen && data.fen !== chess.fen()) {
        // Load the new position
        chess.load(data.fen);

        // Update state
        setFen(data.fen);
        setHistory(data.history || []);
        setCurrentTurn(data.turn || (chess.turn() === 'w' ? 'white' : 'black'));
        
        // Update turn information
        const isWhiteToPlay = chess.turn() === 'w';
        setIsMyTurn(
          (playerColor === 'white' && isWhiteToPlay) || 
          (playerColor === 'black' && !isWhiteToPlay)
        );
        
        checkGameStatus();
      }
      
      if (data.isGameOver) {
        // Handle game over states
        if (data.isCheckmate) {
          const winner = chess.turn() === 'w' ? 'black' : 'white';
          setGameResult(`${winner} won by checkmate`);
        } else if (data.isDraw) {
          setGameResult('Game ended in draw');
        }
      }
    } catch (error) {
      console.error('Error fetching game updates:', error);
      // Don't show an alert for every polling failure as it would be disruptive
      // Instead, update the game status to show connection issues
      setGameStatus('Connection lost. Trying to reconnect...');
    }
  };

  const sendMoveToServer = async (from: Square, to: Square) => {
    try {
      const response = await fetch(`${serverUrl}/api/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId,
          from,
          to,
          promotion: 'q', // Always promote to queen for simplicity
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to send move to server:', errorData.error);
        Alert.alert('Error', errorData.error || 'Failed to send move');
        return false;
      }
      
      const data = await response.json();
      
      // Update local game state
      chess.load(data.fen);
      setFen(data.fen);
      setHistory(data.history);
      setCurrentTurn(data.turn);
      setIsMyTurn(false);
      
      return true;
    } catch (error) {
      console.error('Error sending move to server:', error);
      Alert.alert('Connection Error', 'Failed to send move due to connection issues');
      return false;
    }
  };

  const handleMove = async (from: Square, to: Square) => {
    // Only allow moves if it's the player's turn
    if (!isMyTurn || !isConnected) {
      return;
    }
    
    try {
      // Check if move is valid locally first
      const moveCheck = chess.move({
        from,
        to,
        promotion: 'q',
      });
      
      // Undo the move locally - the server will apply it if valid
      if (moveCheck) {
        chess.undo();
      } else {
        // Invalid move
        return;
      }
      
      // Send move to server
      const success = await sendMoveToServer(from, to);
      
      if (success) {
        checkGameStatus();
      }
    } catch (e) {
      console.error('Invalid move', e);
    }
  };

  const checkGameStatus = () => {
    let status = '';
    let result = null;

    if (chess.isCheckmate()) {
      const winner = chess.turn() === 'w' ? 'black' : 'white';
      status = `Checkmate! ${winner} wins`;
      result = `${winner} won by checkmate`;
    } else if (chess.isDraw()) {
      status = 'Game ended in draw';
      if (chess.isStalemate()) {
        status += ' (Stalemate)';
        result = 'Draw by stalemate';
      } else if (chess.isThreefoldRepetition()) {
        status += ' (Threefold Repetition)';
        result = 'Draw by threefold repetition';
      } else if (chess.isInsufficientMaterial()) {
        status += ' (Insufficient Material)';
        result = 'Draw by insufficient material';
      } else {
        status += ' (50-move rule)';
        result = 'Draw by 50-move rule';
      }
    } else if (chess.isCheck()) {
      status = `${currentTurn} is in check`;
    } else {
      if (isConnected) {
        status = isMyTurn 
          ? `Your turn (${playerColor})` 
          : `Waiting for opponent (${playerColor === 'white' ? 'black' : 'white'})`;
      } else {
        status = waitingForOpponent 
          ? 'Waiting for opponent to join...'
          : `${currentTurn}'s turn`;
      }
    }

    setGameStatus(status);
    if (result) {
      setGameResult(result);
    }
  };

  const resetGame = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gameId }),
      });

      if (!response.ok) {
        console.error('Failed to reset game');
        Alert.alert('Error', 'Failed to reset game');
        return;
      }

      const data = await response.json();
      
      // Update local game state
      chess.load(data.fen);
      setFen(data.fen);
      setHistory([]);
      setCurrentTurn('white');
      setGameStatus("white's turn");
      setGameResult(null);
      setIsMyTurn(playerColor === 'white');
    } catch (error) {
      console.error('Error resetting game:', error);
      Alert.alert('Connection Error', 'Failed to reset game due to connection issues');
    }
  };

  const undoMove = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/undo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gameId }),
      });

      if (!response.ok) {
        console.error('Failed to undo move');
        Alert.alert('Error', 'Failed to undo move');
        return;
      }

      const data = await response.json();
      
      // Update local game state
      chess.load(data.fen);
      setFen(data.fen);
      setHistory(data.history);
      setCurrentTurn(data.turn);
      setIsMyTurn(
        (playerColor === 'white' && data.turn === 'white') || 
        (playerColor === 'black' && data.turn === 'black')
      );
      checkGameStatus();
    } catch (error) {
      console.error('Error undoing move:', error);
      Alert.alert('Connection Error', 'Failed to undo move due to connection issues');
    }
  };

  const renderGameSetup = () => {
    if (isConnected || waitingForOpponent) {
      return (
        <View style={styles.gameInfo}>
          <Text style={styles.gameInfoText}>
            Game ID: {gameId} (Share this with your opponent)
          </Text>
          <Text style={styles.gameInfoText}>
            Players Connected: {playersConnected}/2
          </Text>
          <Text style={styles.gameInfoText}>
            You are playing as: {playerColor}
          </Text>
          <Text style={styles.gameInfoText}>
            Server: {serverUrl}
          </Text>
          {waitingForOpponent && (
            <View style={styles.waitingContainer}>
              <ActivityIndicator size="large" color="#7c3aed" />
              <Text style={styles.waitingText}>Waiting for opponent to join...</Text>
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={styles.setupContainer}>
        {/* Server URL configuration */}
        <View style={styles.serverUrlContainer}>
          <Text style={styles.setupSubtitle}>Server Connection</Text>
          <View style={styles.serverInputRow}>
            <TextInput
              style={styles.serverUrlInput}
              placeholder="Server URL (e.g., http://192.168.0.1:3000)"
              value={serverUrl}
              onChangeText={setServerUrl}
            />
            <Button 
              title={showServerUrlInput ? "Hide" : "Edit"} 
              onPress={() => setShowServerUrlInput(!showServerUrlInput)} 
            />
          </View>
          {showServerUrlInput && (
            <Text style={styles.helperText}>
              If using your mobile device, enter your computer's local IP address instead of localhost
            </Text>
          )}
        </View>
        
        {showCreateGame ? (
          <View style={styles.joinGameContainer}>
            <Text style={styles.setupTitle}>Your game has been created</Text>
            <Text style={styles.gameIdText}>Game ID: {tempGameId}</Text>
            <Text style={styles.setupInstruction}>
              Share this ID with your opponent and then press Join Game
            </Text>
            <Button title="Join Game" onPress={joinGame} disabled={isConnecting} />
            {isConnecting && <ActivityIndicator style={{marginTop: 10}} />}
          </View>
        ) : (
          <View style={styles.setupButtonsContainer}>
            <Button title="Create New Game" onPress={createGame} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.joinGameContainer}>
              <TextInput
                style={styles.gameIdInput}
                placeholder="Enter Game ID"
                value={tempGameId}
                onChangeText={setTempGameId}
              />
              <Button title="Join Game" onPress={joinGame} disabled={isConnecting} />
              {isConnecting && <ActivityIndicator style={{marginTop: 10}} />}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Chess Online</Text>
        <Link href="/" asChild>
          <Button title="Back to Map" />
        </Link>
      </View>

      {renderGameSetup()}

      <View style={[styles.boardContainer, !isConnected && !waitingForOpponent && styles.disabledBoard]}>
        <ChessBoard 
          fen={fen} 
          size={boardSize} 
          onMove={handleMove} 
          flipped={playerColor === 'black'}
        />
      </View>

      <Text style={styles.status}>{gameStatus}</Text>

      {isConnected && (
        <View style={styles.buttonContainer}>
          <Button title="Reset Game" onPress={resetGame} />
          <Button title="Undo Move" onPress={undoMove} disabled={history.length === 0} />
        </View>
      )}

      {gameResult && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>{gameResult}</Text>
        </View>
      )}

      {isConnected && (
        <View style={styles.historyContainer}>
          <Text style={styles.historyTitle}>Move History:</Text>
          <ScrollView style={styles.historyScroll}>
            {history.length > 0 ? (
              history.map((move, index) => (
                <Text key={index} style={styles.moveText}>
                  {index % 2 === 0 ? `${Math.floor(index / 2) + 1}.` : ''} {move}
                </Text>
              ))
            ) : (
              <Text style={styles.emptyHistory}>No moves yet</Text>
            )}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  setupContainer: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  setupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  setupSubtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  setupInstruction: {
    marginVertical: 12,
    textAlign: 'center',
    color: '#555',
  },
  setupButtonsContainer: {
    alignItems: 'center',
  },
  serverUrlContainer: {
    marginBottom: 16,
    padding: 8,
    borderRadius: 4,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  serverInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serverUrlInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
    marginRight: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  gameIdInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
    width: '100%',
  },
  joinGameContainer: {
    width: '100%',
    alignItems: 'center',
  },
  orText: {
    marginVertical: 12,
    fontSize: 16,
    fontWeight: 'bold',
  },
  gameIdText: {
    fontSize: 16,
    fontWeight: 'bold',
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 8,
  },
  boardContainer: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 16,
  },
  disabledBoard: {
    opacity: 0.7,
  },
  status: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 16,
  },
  resultContainer: {
    marginVertical: 16,
    padding: 12,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  resultText: {
    fontSize: 16,
    color: '#2e7d32',
    fontWeight: '500',
    textAlign: 'center',
  },
  historyContainer: {
    flex: 1,
    width: '100%',
    marginTop: 16,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  historyScroll: {
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 4,
    flex: 1,
  },
  moveText: {
    fontSize: 14,
    marginBottom: 4,
  },
  emptyHistory: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#888',
  },
  gameInfo: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#e6f7ff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#1890ff',
  },
  gameInfoText: {
    fontSize: 14,
    marginBottom: 4,
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fffbe6',
    borderRadius: 4,
  },
  waitingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#d48806',
  },
});
