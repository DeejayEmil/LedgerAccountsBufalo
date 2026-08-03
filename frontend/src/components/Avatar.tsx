import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';

function initialsFrom(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '');
  return initials.join('') || '?';
}

export function Avatar({
  fullName,
  avatarUrl,
  size = 48,
}: {
  fullName: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[styles.image, dimensionStyle]}
        accessibilityLabel="Foto de perfil"
      />
    );
  }

  return (
    <View style={[styles.placeholder, dimensionStyle]}>
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initialsFrom(fullName)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.border,
  },
  placeholder: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
});
