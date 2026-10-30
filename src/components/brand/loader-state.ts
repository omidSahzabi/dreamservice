export type LoaderState = {
  phase: "loading" | "completing" | "complete";
  loading: boolean;
  success: boolean;
  cycle: number;
};
export function initialLoaderState(loading: boolean, success: boolean): LoaderState {
  return { phase: loading ? "loading" : "complete", loading, success, cycle: 0 };
}
export function updateLoaderState(state: LoaderState, loading: boolean, success: boolean): LoaderState {
  if (state.loading === loading && state.success === success) return state;
  return {
    loading, success,
    cycle: loading && !state.loading ? state.cycle + 1 : state.cycle,
    phase: loading ? "loading" : state.loading && success ? "completing" : "complete",
  };
}
export function finishLoaderState(state: LoaderState, cycle: number): LoaderState {
  return state.phase === "completing" && state.cycle === cycle ? { ...state, phase: "complete" } : state;
}
