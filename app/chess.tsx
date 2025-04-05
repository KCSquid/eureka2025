import { Chess, Square } from 'chess.js';
import { Link } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Button, ScrollView, Dimensions, SafeAreaView } from 'react-native';

import ChessBoard from '../components/chessboard';

export default function ChessGame() {
  const [chess] = useState(new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [history, setHistory] = useState<string[]>([]);
  const [currentTurn, setCurrentTurn] = useState<'white' | 'black'>('white');
  const [gameStatus, setGameStatus] = useState<string>('');
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [gameId] = useState(`game-${Date.now()}`); // Unique game ID
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const boardSize = Math.min(Dimensions.get('window').width - 32, 350);

  useEffect(() => {
    checkGameStatus();

    // Start polling for game updates
    startPolling();

    return () => {
      // Cleanup polling on component unmount
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    checkGameStatus();
  }, [fen]);

  const startPolling = () => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Set up new polling interval
    pollingIntervalRef.current = setInterval(fetchGameUpdates, 500);
  };

  const fetchGameUpdates = async () => {
    try {
      const response = await fetch(`http://localhost:3000/api/GetInfo`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();

        // Only update if the server has a newer state
        if (data.fen && data.fen !== chess.fen()) {
          // Load the new position
          chess.load(data.fen);

          // Update state
          setFen(data.fen);
          setHistory(chess.history());
          setCurrentTurn(chess.turn() === 'w' ? 'white' : 'black');
          checkGameStatus();
        }
      }
    } catch (error) {
      console.error('Error fetching game updates:', error);
    }
  };

  const sendMoveToServer = async (from: Square, to: Square, newFen: string) => {
    try {
      const response = await fetch('http://localhost:3000/api/SendInfo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId,
          from,
          to,
          fen: newFen,
          history: chess.history(),
          turn: chess.turn(),
        }),
      });

      if (!response.ok) {
        console.log('Failed to send move to server');
      }
    } catch (error) {
      console.error('Error sending move to server:', error);
    }
  };

  const handleMove = (from: Square, to: Square) => {
    try {
      const move = chess.move({
        from,
        to,
        promotion: 'q', // always promote to queen for simplicity
      });

      if (move) {
        const newFen = chess.fen();
        setFen(newFen);
        setHistory(chess.history());
        setCurrentTurn(chess.turn() === 'w' ? 'white' : 'black');
        checkGameStatus();

        // Send move to server
        sendMoveToServer(from, to, newFen);
      }
    } catch (e) {
      console.log('Invalid move', e);
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
      status = `${currentTurn}'s turn`;
    }

    setGameStatus(status);
    if (result) {
      setGameResult(result);
    }
  };

  const resetGame = () => {
    chess.reset();
    const newFen = chess.fen();
    setFen(newFen);
    setHistory([]);
    setCurrentTurn('white');
    setGameStatus("white's turn");
    setGameResult(null);

    // Send reset to server
    try {
      fetch('https://your-api-endpoint.com/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId,
          fen: newFen,
        }),
      });
    } catch (error) {
      console.error('Error sending game reset to server:', error);
    }
  };

  const undoMove = () => {
    const move = chess.undo();
    if (move) {
      const newFen = chess.fen();
      setFen(newFen);
      setHistory(chess.history());
      setCurrentTurn(chess.turn() === 'w' ? 'white' : 'black');
      checkGameStatus();

      // Send undo to server
      try {
        fetch('https://your-api-endpoint.com/undo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            gameId,
            fen: newFen,
            history: chess.history(),
          }),
        });
      } catch (error) {
        console.error('Error sending undo to server:', error);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Chess 9060</Text>
        <Link href="/" asChild>
          <Button title="Back to Map" />
        </Link>
      </View>

      <View style={styles.boardContainer}>
        <ChessBoard fen={fen} size={boardSize} onMove={handleMove} />
      </View>

      <Text style={styles.status}>{gameStatus}</Text>

      <View style={styles.buttonContainer}>
        <Button title="Reset Game" onPress={resetGame} />
        <Button title="Undo Move" onPress={undoMove} disabled={history.length === 0} />
      </View>

      {gameResult && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>{gameResult}</Text>
        </View>
      )}

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
});
