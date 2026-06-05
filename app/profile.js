import { useRouter } from 'expo-router';
import ProfileScreen from '../src/screens/ProfileScreen';

export default function ProfileRoute() {
  const router = useRouter();
  const navigation = { goBack: () => router.back() };
  return <ProfileScreen navigation={navigation} />;
}
