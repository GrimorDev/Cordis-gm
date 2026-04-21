import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { C, STATUS_COLOR } from '../theme';
import { STATIC_BASE } from '../config';

/** Converts a relative path (/uploads/...) to a full URL. */
function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${STATIC_BASE}${url}`;
}

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
  const resolvedUrl = resolveUrl(url);

  return (
    <View style={{ width: size, height: size }}>
      {resolvedUrl ? (
        <Image
          source={{ uri: resolvedUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          cachePolicy="memory-disk"
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
