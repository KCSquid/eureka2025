import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Chess, Square } from 'chess.js';

// Define piece symbols
const PIECES: Record<string, string> = {
  p: '♟',
  n: '♞',
  b: '♝',
  r: '♜',
  q: '♛',
  k: '♚',
  P: '♙',
  N: '♘',
  B: '♗',
  R: '♖',
  Q: '♕',
  K: '♔',
};

interface ChessBoardProps {
  fen: string;
  onMove: (from: Square, to: Square) => void;
  flipped?: boolean;
  size?: number;
}

export default function ChessBoard({ fen, onMove, flipped = false, size = 350 }: ChessBoardProps) {
  const chess = new Chess(fen);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const cellSize = size / 8;

  // Create board representation from FEN
  const board = chess.board();

  // Flip board if needed
  const displayBoard = flipped ? [...board].reverse().map((row) => [...row].reverse()) : board;

  const handleSquarePress = (row: number, col: number) => {
    // Convert to chess notation (a-h)(1-8)
    const files = flipped ? 'hgfedcba' : 'abcdefgh';
    const ranks = flipped ? '12345678' : '87654321';
    const square = `${files[col]}${ranks[row]}` as Square;

    // If a square is already selected, try to move
    if (selectedSquare) {
      if (selectedSquare === square) {
        // Deselect if same square
        setSelectedSquare(null);
      } else {
        // Try to make a move
        onMove(selectedSquare, square);
        setSelectedSquare(null);
      }
    } else {
      // Select a square with a piece
      const piece = chess.get(square);
      if (
        piece &&
        ((piece.color === 'w' && chess.turn() === 'w') ||
          (piece.color === 'b' && chess.turn() === 'b'))
      ) {
        setSelectedSquare(square);
      }
    }
  };

  const isSelected = (row: number, col: number) => {
    if (!selectedSquare) return false;

    const files = flipped ? 'hgfedcba' : 'abcdefgh';
    const ranks = flipped ? '12345678' : '87654321';
    const square = `${files[col]}${ranks[row]}`;

    return square === selectedSquare;
  };

  return (
    <View style={[styles.board, { width: size, height: size }]}>
      {displayBoard.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((cell, colIndex) => {
            const isDark = (rowIndex + colIndex) % 2 === 1;
            const isHighlighted = isSelected(rowIndex, colIndex);

            return (
              <TouchableOpacity
                key={colIndex}
                style={[
                  styles.cell,
                  {
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: isHighlighted ? '#8fc78a' : isDark ? '#b58863' : '#f0d9b5',
                  },
                ]}
                onPress={() => handleSquarePress(rowIndex, colIndex)}>
                {cell && (
                  <Text
                    style={[
                      styles.piece,
                      {
                        fontSize: cellSize * 0.7,
                        color: cell.color === 'w' ? '#ffffff' : '#000000',
                      },
                    ]}>
                    {PIECES[cell.type.toUpperCase() + (cell.color === 'w' ? '' : cell.color)]}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    borderWidth: 2,
    borderColor: '#333',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  piece: {
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
});
