import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

const testFen = "4k3/8/8/8/8/8/8/3QK3 w - - 0 1"

export default function ChessPage() {
  const [game, setGame] = useState<Chess | null>(null);
  const [fen, setFen] = useState<string>('');

  useEffect(() => {
    // Initialize a new Chess 960 game
    const newGame = new Chess();
    //newGame.load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    newGame.load(testFen);
    setGame(newGame);
    setFen(newGame.fen());
  }, []);

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (!game) return false;

    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // always promote to queen for simplicity
      });

      if (move === null) return false;
      
      setFen(game.fen());
      return true;
    } catch (e) {
      return false;
    }
  };

  const startNewGame = () => {
    const newGame = new Chess();
    //newGame.load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    newGame.load(testFen);
    setGame(newGame);
    setFen(newGame.fen());
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chess 960</Text>
      <View style={styles.boardContainer}>
        <Chessboard
          position={fen}
          onPieceDrop={onDrop}
          boardWidth={350}
          customBoardStyle={{
            borderRadius: '4px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
          }}
        />
      </View>
      <TouchableOpacity style={styles.button} onPress={startNewGame}>
        <Text style={styles.buttonText}>New Game</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  boardContainer: {
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 