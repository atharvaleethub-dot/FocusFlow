import { createCommitment } from '../data/schema';

export function saveAvailabilityInState(state, availability) {
  return { state: { ...state, availability } };
}

export function addCommitmentToState(state, values) {
  const commitment = createCommitment(values);
  return { state: { ...state, commitments: [...state.commitments, commitment] }, commitment };
}

export function updateCommitmentInState(state, commitmentId, values) {
  const existing = state.commitments.find((item) => item.id === commitmentId);
  if (!existing) return { state, commitment: null };
  const commitment = { ...existing, ...values };
  return {
    state: {
      ...state,
      commitments: state.commitments.map((item) => (item.id === commitmentId ? commitment : item)),
    },
    commitment,
  };
}

export function deleteCommitmentFromState(state, commitmentId) {
  const existing = state.commitments.find((item) => item.id === commitmentId);
  if (!existing) return { state, commitment: null };
  return {
    state: {
      ...state,
      commitments: state.commitments.filter((item) => item.id !== commitmentId),
    },
    commitment: existing,
  };
}