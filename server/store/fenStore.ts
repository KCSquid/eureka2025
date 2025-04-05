let currentFEN: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Initial chess position

export const getFEN = () => currentFEN;

export const setFEN = (newFEN: string) => {
  currentFEN = newFEN;
}; 