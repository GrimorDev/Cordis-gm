import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { C, STATUS_COLOR } from '../theme';

interface Props {
  url?: string | null;
  username: string;
  size?: number;
  status?: string | null;
  showStatus?: boolean;
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export function UserAvatar({ url, username, size = 40, status, showStatus = false }: Props) {
  const dotSize = Math.max(10, size * 0.28);

  return (
    <View style={{ width: size, height: size }}>
      {url ? (
        <Image
          source={{ uri: url }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials(username)}</Text>
        </View>
      )}
      {showStatus && status && (
        <View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: STATUS_COLOR[status] ?? C.offline,
              bottom: 0,
              right: 0,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '700',
  },
  dot: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: C.bg,
  },
});
