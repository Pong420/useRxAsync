import { useEffect, useCallback, useReducer, useRef, Reducer } from 'react';
import { from, ObservableInput, Subject, empty } from 'rxjs';
import {
  map,
  catchError,
  exhaustMap,
  switchMap,
  concatMap,
  mergeMap,
  flatMap,
  takeUntil,
} from 'rxjs/operators';

type RxAsyncFnWithParam<I, P> = (params: P) => ObservableInput<I>;

type RxAsyncFnOptionalParam<I, P> =
  | (() => ObservableInput<I>)
  | ((params?: P) => ObservableInput<I>);

export type RxAsyncFn<I, P> =
  | RxAsyncFnOptionalParam<I, P>
  | RxAsyncFnWithParam<I, P>;

export interface RxAsyncOptions<I> {
  initialValue?: I;
  defer?: boolean;
  onStart?(): void;
  onSuccess?(value: I): void;
  onFailure?(error: any): void;
  mapOperator?:
    | typeof switchMap
    | typeof concatMap
    | typeof exhaustMap
    | typeof mergeMap
    | typeof flatMap;
}

interface RxAsyncStateCommon<I> extends State<I> {
  cancel: () => void;
  reset: () => void;
}

type RxAsyncStateWithParam<I, P> = RxAsyncStateCommon<I> & {
  run: (params: P) => void;
};

type RxAsyncStateOptionalParam<I, P> = RxAsyncStateCommon<I> & {
  run: (() => void) | ((params?: P) => void);
};

export type RxAsyncState<I, P> =
  | RxAsyncStateOptionalParam<I, P>
  | RxAsyncStateWithParam<I, P>;

interface State<I> {
  loading: boolean;
  error?: any;
  data?: I;
}

type Actions<I> =
  | { type: 'FETCH_INIT' }
  | { type: 'FETCH_SUCCESS'; payload: I }
  | { type: 'FETCH_FAILURE'; payload?: any }
  | { type: 'CANCEL' }
  | { type: 'RESET'; payload?: I };

function init<I>(data?: I): State<I> {
  return {
    loading: false,
    data,
  };
}

function reducer<I>(state: State<I>, action: Actions<I>): State<I> {
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

export function useRxAsync<I, P>(
  fn: RxAsyncFnOptionalParam<I, P>,
  options: RxAsyncOptions<I> & {
    initialValue: I;
  }
): RxAsyncStateOptionalParam<I, P> & { data: I };

export function useRxAsync<I, P>(
  fn: RxAsyncFnWithParam<I, P>,
  options: RxAsyncOptions<I> & {
    initialValue: I;
    defer: true;
  }
): RxAsyncStateWithParam<I, P> & { data: I };

export function useRxAsync<I, P>(
  fn: RxAsyncFnOptionalParam<I, P>,
  options?: RxAsyncOptions<I>
): RxAsyncStateOptionalParam<I, P>;

export function useRxAsync<I, P>(
  fn: RxAsyncFnWithParam<I, P>,
  options: RxAsyncOptions<I> & {
    defer: true;
  }
): RxAsyncStateWithParam<I, P>;

export function useRxAsync<I, P>(
  fn: RxAsyncFn<I, P>,
  options: RxAsyncOptions<I> = {}
): RxAsyncState<I, P> {
  const {
    defer,
    initialValue,
    onStart,
    onSuccess,
    onFailure,
    mapOperator = switchMap,
  } = options || {};

  const [state, dispatch] = useReducer<
    Reducer<State<I>, Actions<I>>,
    I | undefined
  >(reducer, initialValue, init);

  const subject = useRef(new Subject<P>());
  const cancelSubject = useRef(new Subject());

  const run = useCallback(
    (params?: P) => subject.current.next(params as P),
    []
  );

  const cancel = useCallback(() => {
    cancelSubject.current.next();
    dispatch({ type: 'CANCEL' });
  }, [dispatch]);

  const reset = useCallback(() => {
    cancelSubject.current.next();
    dispatch({ type: 'RESET', payload: initialValue });
  }, [initialValue]);

  useEffect(() => {
    reset();

    const subscription = subject.current
      .pipe(
        mapOperator(params => {
          onStart && onStart();
          dispatch({ type: 'FETCH_INIT' });
          return from<ObservableInput<I>>(fn(params)).pipe(
            map(payload => {
              dispatch({ type: 'FETCH_SUCCESS', payload });
              onSuccess && onSuccess(payload);
            }),
            catchError(payload => {
              dispatch({ type: 'FETCH_FAILURE', payload });
              onFailure && onFailure(payload);
              return empty();
            }),
            takeUntil(cancelSubject.current)
          );
        })
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }, [
    dispatch,
    run,
    defer,
    reset,
    fn,
    mapOperator,
    onStart,
    onSuccess,
    onFailure,
  ]);

  useEffect(() => {
    !defer && run();
  }, [dispatch, run, defer, fn]);

  return { ...state, run, cancel, reset };
}
