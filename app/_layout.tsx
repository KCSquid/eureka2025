import { Stack } from 'expo-router';
import React from 'react';
import '../global.css';

export default function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
