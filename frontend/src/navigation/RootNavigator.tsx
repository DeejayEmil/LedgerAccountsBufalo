import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { LoadingView } from '../components/StateViews';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { AccountsScreen } from '../screens/AccountsScreen';
import { AccountDetailScreen } from '../screens/AccountDetailScreen';
import { NewTransactionScreen } from '../screens/NewTransactionScreen';
import type { AppStackParamList, AuthStackParamList } from './types';
import { colors } from '../components/theme';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
      }}
    >
      <AppStack.Screen name="Accounts" component={AccountsScreen} options={{ headerShown: false }} />
      <AppStack.Screen
        name="AccountDetail"
        component={AccountDetailScreen}
        options={{ title: 'Detalle de cuenta' }}
      />
      <AppStack.Screen
        name="NewTransaction"
        component={NewTransactionScreen}
        options={{ title: 'Nuevo movimiento', presentation: 'modal' }}
      />
    </AppStack.Navigator>
  );
}

export function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingView label="Preparando QikBanco…" />;
  }

  return (
    <NavigationContainer>{user ? <AppNavigator /> : <AuthNavigator />}</NavigationContainer>
  );
}
