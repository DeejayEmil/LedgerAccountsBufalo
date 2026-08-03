import { gql } from '@apollo/client';

export const UPDATE_AVATAR_MUTATION = gql`
  mutation UpdateAvatar($avatarUrl: String!) {
    updateAvatar(avatarUrl: $avatarUrl) {
      id
      email
      fullName
      avatarUrl
    }
  }
`;
