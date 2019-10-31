import { useEffect, useCallback, useReducer, useRef, Reducer } from 'react';
import { from, Subscription, Observable, ObservableInput } from 'rxjs';

type RxAsyncFnWithParam<T, P> = (params: P) => ObservableInput<T>;

type RxAsyncFnOptionalParam<T, P> =
  | (() => ObservableInput<T>)
  | ((params?: P) => ObservableInput<T>);

export type RxAsyncFn<T, P> =
  | RxAsyncFnOptionalParam<T, P>
  | RxAsyncFnWithParam<T, P>;

export interface RxAsyncOptions<I, O = I> {
  initialValue?: O;
  defer?: boolean;
  pipe?: (ob: Observable<I>) => Observable<O>;
  onStart?(): void;
  onSuccess?(value: O): void;
  onFailure?(error: any): void;
}

interface RxAsyncStateCommon<T> extends State<T> {
  cancel: () => void;
  reset: () => void;
}

type RxAsyncStateWithParam<T, P> = RxAsyncStateCommon<T> & {
  run: (params: P) => void;
};

type RxAsyncStateOptionalParam<T, P> = RxAsyncStateCommon<T> & {
  run: (() => void) | ((params?: P) => void);
};

export type RxAsyncState<T, P> =
  | RxAsyncStateOptionalParam<T, P>
  | RxAsyncStateWithParam<T, P>;

interface State<T> {
  loading: boolean;
  error?: any;
  data?: T;
}

type Actions<T> =
  | { type: 'FETCH_INIT' }
  | { type: 'FETCH_SUCCESS'; payload: T }
  | { type: 'FETCH_FAILURE'; payload?: any }
  | { type: 'CANCEL' }
  | { type: 'RESET'; payload?: T };

function init<T>(data?: T): State<T> {
  return {
    loading: false,
    data,
  };
}

function reducer<T>(state: State<T>, action: Actions<T>): State<T> {
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

export function useRxAsync<T, P, O = T>(
  fn: RxAsyncFnOptionalParam<O, P>,
  options: RxAsyncOptions<T, O> & {
    initialValue: O;
  }
): RxAsyncStateOptionalParam<O, P> & { data: O };

export function useRxAsync<T, P, O = T>(
  fn: RxAsyncFnWithParam<O, P>,
  options: RxAsyncOptions<T, O> & {
    initialValue: O;
    defer: true;
  }
): RxAsyncStateWithParam<O, P> & { data: O };

export function useRxAsync<T, P, O = T>(
  fn: RxAsyncFnOptionalParam<O, P>,
  options?: RxAsyncOptions<T, O>
): RxAsyncStateOptionalParam<O, P>;

export function useRxAsync<T, P, O = T>(
  fn: RxAsyncFnWithParam<O, P>,
  options: RxAsyncOptions<T, O> & {
    defer: true;
  }
): RxAsyncStateWithParam<O, P>;

export function useRxAsync<T, P, O = T>(
  fn: RxAsyncFn<O, P>,
  options: RxAsyncOptions<T, O> = {}
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
