import { ApolloClient, ApolloLink, InMemoryCache, from } from '@apollo/client';
import { HttpLink } from '@apollo/client/link/http';
import { SetContextLink } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GRAPHQL_URL } from '../config';
import { emitSessionExpired } from '../auth/sessionEvents';

const ACCESS_TOKEN_KEY = 'qikbanco.accessToken';

const httpLink = new HttpLink({ uri: GRAPHQL_URL });

// Adjunta el JWT (guardado por AuthContext en AsyncStorage) a cada
// operación GraphQL saliente.
const authLink = new SetContextLink(async (prevContext) => {
  const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  return {
    headers: {
      ...prevContext.headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

// Si el token expiró o dejó de ser válido, el backend responde con un
// error de autenticación en cada query/mutation protegida. Sin esto, el
// usuario queda atrapado en una pantalla de error sin ninguna salida
// visible (la vimos en la práctica). Detectamos ese caso y avisamos a
// AuthContext para que cierre la sesión y vuelva a mostrar el login.
const authErrorLink = new ErrorLink(({ error }) => {
  if (!CombinedGraphQLErrors.is(error)) {
    return;
  }
  const isAuthError = error.errors.some((graphQLError) => {
    const code = graphQLError.extensions?.code;
    return (
      code === 'UNAUTHENTICATED' ||
      code === 'FORBIDDEN' ||
      /unauthorized/i.test(graphQLError.message)
    );
  });
  if (isAuthError) {
    emitSessionExpired();
  }
});

export const apolloClient = new ApolloClient({
  link: from([authErrorLink, authLink as unknown as ApolloLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' },
  },
});
