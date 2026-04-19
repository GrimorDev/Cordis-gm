import { Redirect } from 'expo-router';
import { useStore } from '../src/store';

export default function Index() {
  const { isAuthenticated } = useStore();
  return <Redirect href={isAuthenticated ? '/(app)' : '/(auth)/login'} />;
}
