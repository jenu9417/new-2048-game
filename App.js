import React, { useEffect, useState } from 'react';
import { Button, PanResponder, StyleSheet, Text, View, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GRID_SIZE = 4;

const createEmptyGrid = () => {
  return Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));
};

const getTileColor = (value) => {
  switch (value) {
    case 2: return '#eee4da';
    case 4: return '#ede0c8';
    case 8: return '#f2b179';
    case 16: return '#f59563';
    case 32: return '#f67c5f';
    case 64: return '#f65e3b';
    case 128: return '#edcf72';
    case 256: return '#edcc61';
    case 512: return '#edc850';
    case 1024: return '#edc53f';
    case 2048: return '#edc22e';
    default: return '#cdc1b4';
  }
};

const addRandomTile = (grid) => {
  const emptyTiles = [];
  grid.forEach((row, r) =>
    row.forEach((val, c) => {
      if (val === 0) emptyTiles.push({ r, c });
    })
  );

  if (emptyTiles.length === 0) return grid;

  const { r, c } = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
  grid[r][c] = Math.random() > 0.9 ? 4 : 2;
  return [...grid];
};

const cloneGrid = (grid) => grid.map((row) => [...row]);

const rotateGrid = (grid) => {
  return grid[0].map((_, c) => grid.map((row) => row[c])).reverse();
};

export default function App() {
  const [grid, setGrid] = useState(addRandomTile(addRandomTile(createEmptyGrid())));
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  // Load high score and game state (grid and score) from AsyncStorage on startup
  useEffect(() => {
    const loadGameState = async () => {
      try {
        const savedHighScore = await AsyncStorage.getItem('highScore');
        const savedGrid = await AsyncStorage.getItem('grid');
        const savedScore = await AsyncStorage.getItem('score');

        if (savedHighScore) {
          setHighScore(parseInt(savedHighScore));
        }

        if (savedGrid && savedScore) {
          setGrid(JSON.parse(savedGrid));
          setScore(parseInt(savedScore));
        } else {
          // If no saved grid, initialize a new game
          setGrid(addRandomTile(addRandomTile(createEmptyGrid())));
        }
      } catch (error) {
        console.error("Error loading game state:", error);
      }
    };

    loadGameState();
  }, []);

  // Save the grid and score to AsyncStorage
  const saveGameState = async () => {
    try {
      await AsyncStorage.setItem('grid', JSON.stringify(grid));
      await AsyncStorage.setItem('score', score.toString());
      if (score > highScore) {
        setHighScore(score);
        await AsyncStorage.setItem('highScore', score.toString());
      }
    } catch (error) {
      console.error("Error saving game state:", error);
    }
  };

  const moveLeft = (grid) => {
    let newGrid = cloneGrid(grid);
    let moved = false;
  
    for (let r = 0; r < GRID_SIZE; r++) {
      let row = newGrid[r].filter((v) => v !== 0);
      for (let i = 0; i < row.length - 1; i++) {
        if (row[i] === row[i + 1]) {
          row[i] *= 2;
          setScore(prev => {
            const newScore = prev + row[i];
            if (newScore > highScore) {
              setHighScore(newScore);
              AsyncStorage.setItem('highScore', newScore.toString());
            }
            return newScore;
          });
          row[i + 1] = 0;
          moved = true;
        }
      }
      row = row.filter((v) => v !== 0);
      while (row.length < GRID_SIZE) row.push(0);
      newGrid[r] = row;
      if (JSON.stringify(grid[r]) !== JSON.stringify(row)) moved = true;
    }
  
    return { newGrid, moved };
  };

  const swipe = (grid, direction) => {
    let newGrid = cloneGrid(grid);
  
    // Rotate based on direction
    let rotateCount = 0;
    if (direction === 'up') rotateCount = 1;
    else if (direction === 'right') rotateCount = 2;
    else if (direction === 'down') rotateCount = 3;
  
    for (let i = 0; i < rotateCount; i++) newGrid = rotateGrid(newGrid);
  
    const { newGrid: movedGrid, moved } = moveLeft(newGrid);
    
    let finalGrid = movedGrid;
    for (let i = 0; i < (4 - rotateCount) % 4; i++) {
      finalGrid = rotateGrid(finalGrid);
    }
  
    return { newGrid: finalGrid, moved };
  };

  // Handle swipe and save progress after each move
  const handleSwipe = (direction) => {
    const { newGrid, moved } = swipe(grid, direction);
    if (moved) {
      const addedTileGrid = addRandomTile(newGrid);
      setGrid(addedTileGrid);
      setScore(prev => {
        const newScore = prev + addedTileGrid.flat().reduce((acc, val) => acc + val, 0);
        if (newScore > highScore) {
          setHighScore(newScore);
          AsyncStorage.setItem('highScore', newScore.toString());
        }
        return newScore;
      });
      saveGameState();
      if (checkGameOver(addedTileGrid)) {
        Alert.alert(
          'Game Over',
          'No more moves left!',
          [
            { text: 'Restart', onPress: restartGame }
          ],
          { cancelable: false }
        );
      }
    }
  };

  const showAbout = () => {
    Alert.alert(
      'About This App',
      '2048 Game\n\nCreated with love: Jenu\nVersion: 1.0',
      [{ text: 'Close' }],
      { cancelable: true }
    );
  };

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 20 || Math.abs(gesture.dy) > 20,
    onPanResponderRelease: (_, gesture) => {
      const dx = gesture.dx;
      const dy = gesture.dy;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) handleSwipe('right');
        else handleSwipe('left');
      } else {
        if (dy > 0) handleSwipe('down');
        else handleSwipe('up');
      }
    },
  });

  // Restart the game and clear the stored game state
  const restartGame = async () => {
    setGrid(addRandomTile(addRandomTile(createEmptyGrid())));
    setScore(0);
    await AsyncStorage.removeItem('grid');
    await AsyncStorage.removeItem('score');
  };

  const checkGameOver = (grid) => {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] === 0) return false; // empty cell exists
        // check right
        if (c < GRID_SIZE - 1 && grid[r][c] === grid[r][c + 1]) return false;
        // check down
        if (r < GRID_SIZE - 1 && grid[r][c] === grid[r + 1][c]) return false;
      }
    }
    return true; // no moves left
  };

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Text style={styles.title}>2048</Text>
      <Text style={styles.score}>Score: {score}</Text>
      <Text style={styles.score}>High Score: {highScore}</Text>
      <View style={styles.grid}>
        {grid.map((row, rIdx) => (
          <View key={rIdx} style={styles.row}>
            {row.map((cell, cIdx) => (
              <View key={cIdx} style={[styles.cell, { backgroundColor: getTileColor(cell) }]}>
                <Text style={styles.cellText}>{cell !== 0 ? cell : ''}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
      <Button title="Restart Game" onPress={restartGame} />
      <Button title="About" onPress={showAbout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF8EF' },
  title: { fontSize: 48, fontWeight: 'bold', marginBottom: 10 },
  score: { fontSize: 24, marginBottom: 20 },
  grid: { backgroundColor: '#BBADA0', padding: 5 },
  row: { flexDirection: 'row' },
  cell: {
    width: 70,
    height: 70,
    margin: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#cdc1b4', // fallback/default
  },
  cellText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#776e65',
  },
});
