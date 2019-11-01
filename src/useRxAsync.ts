import { useEffect, useCallback, useReducer, useRef, Reducer } from 'react';
import { from, Subscription, Observable, ObservableInput } from 'rxjs';

type RxAsyncFnWithParam<I, P> = (params: P) => ObservableInput<I>;

type RxAsyncFnOptionalParam<I, P> =
  | (() => ObservableInput<I>)
  | ((params?: P) => ObservableInput<I>);

export type RxAsyncFn<I, P> =
  | RxAsyncFnOptionalParam<I, P>
  | RxAsyncFnWithParam<I, P>;

export interface RxAsyncOptions<I, O = I> {
  initialValue?: O;
  defer?: boolean;
  pipe?: (ob: Observable<I>) => Observable<O>;
  onStart?(): void;
  onSuccess?(value: O): void;
  onFailure?(error: any): void;
}

interface RxAsyncStateCommon<O> extends State<O> {
  cancel: () => void;
  reset: () => void;
}

type RxAsyncStateWithParam<O, P> = RxAsyncStateCommon<O> & {
  run: (params: P) => void;
};

type RxAsyncStateOptionalParam<O, P> = RxAsyncStateCommon<O> & {
  run: (() => void) | ((params?: P) => void);
};

export type RxAsyncState<O, P> =
  | RxAsyncStateOptionalParam<O, P>
  | RxAsyncStateWithParam<O, P>;

interface State<O> {
  loading: boolean;
  error?: any;
  data?: O;
}

type Actions<O> =
  | { type: 'FETCH_INIT' }
  | { type: 'FETCH_SUCCESS'; payload: O }
  | { type: 'FETCH_FAILURE'; payload?: any }
  | { type: 'CANCEL' }
  | { type: 'RESET'; payload?: O };

function init<O>(data?: O): State<O> {
  return {
    loading: false,
    data,
  };
}

function reducer<O>(state: State<O>, action: Actions<O>): State<O> {
  switch (action.type) {
    case 'FETCH_INIT':
      return { ...init(state.data), loading: true };
    case 'FETCH_SUCCESS':
      return { ...state, loading: false, data: action.payload };
    case 'FETCH_FAILURE':
      return { ...state, loading: false, error: action.payload };
    case 'CANCEL':
      return { ...state, loading: false };
    case 'RESET':
      return { ...init(action.payload) };
    default:
      throw new Error();
  }
}

export function useRxAsync<I, P, O = I>(
  fn: RxAsyncFnOptionalParam<O, P>,
  options: RxAsyncOptions<I, O> & {
    initialValue: O;
  }
): RxAsyncStateOptionalParam<O, P> & { data: O };

export function useRxAsync<I, P, O = I>(
  fn: RxAsyncFnWithParam<O, P>,
  options: RxAsyncOptions<I, O> & {
    initialValue: O;
    defer: true;
  }
): RxAsyncStateWithParam<O, P> & { data: O };

export function useRxAsync<I, P, O = I>(
  fn: RxAsyncFnOptionalParam<O, P>,
  options?: RxAsyncOptions<I, O>
): RxAsyncStateOptionalParam<O, P>;

export function useRxAsync<I, P, O = I>(
  fn: RxAsyncFnWithParam<O, P>,
  options: RxAsyncOptions<I, O> & {
    defer: true;
  }
): RxAsyncStateWithParam<O, P>;

export function useRxAsync<I, P, O = I>(
  fn: RxAsyncFn<O, P>,
  options: RxAsyncOptions<I, O> = {}
): RxAsyncState<O, P> {
  const { defer, pipe, initialValue, onStart, onSuccess, onFailure } =
    options || {};

  const [state, dispatch] = useReducer<
    Reducer<State<O>, Actions<O>>,
    O | undefined
  >(reducer, initialValue, init);

  const subscription = useRef(new Subscription());

  const run = useCallback(
    (params?: P) => {
      onStart && onStart();

      dispatch({ type: 'FETCH_INIT' });

      let source$: Observable<any> = from(fn(params as P));

      if (pipe) {
        source$ = source$.pipe(pipe);
      }

      const newSubscription = source$.subscribe(
        payload => {
          dispatch({ type: 'FETCH_SUCCESS', payload });
          onSuccess && onSuccess(payload);
        },
        payload => {
          dispatch({ type: 'FETCH_FAILURE', payload });
          onFailure && onFailure(payload);
        }
      );

      subscription.current.unsubscribe();
      subscription.current = newSubscription;
    },
    [fn, pipe, onStart, onSuccess, onFailure]
  );

  const cancel = useCallback(() => {
    subscription.current.unsubscribe();
    dispatch({ type: 'CANCEL' });
  }, [dispatch, subscription]);

  const reset = useCallback(
    () => dispatch({ type: 'RESET', payload: initialValue }),
    [initialValue]
  );

  useEffect(() => {
    !defer && run();
  }, [dispatch, run, defer]);

  return { ...state, run, cancel, reset };
}
