import { useCallback, useState } from 'react';
import { renderHook, act } from '@testing-library/react-hooks';
import { useRxAsync } from '../useRxAsync';
import { mergeMap } from 'rxjs/operators';

const request = () => Promise.resolve(1);
const requestWithParam = (ms: number) => Promise.resolve(ms);
const requestWithoutParam = () => Promise.resolve(1000);
const requestOptionalParam = (ms = 1000) => Promise.resolve(ms);
const errorReqest = async () => Promise.reject('error');

test('typings', async () => {
  const caseA = renderHook(() => useRxAsync(requestWithParam, { defer: true }));
  const caseB = renderHook(() =>
    useRxAsync(requestWithoutParam, { defer: true })
  );
  const caseC = renderHook(() =>
    useRxAsync(requestOptionalParam, { defer: true })
  );
  const caseD = renderHook(() => useRxAsync(requestWithoutParam));

  act(() => caseA.result.current.run(1000));
  await caseA.waitForNextUpdate();

  act(() => caseB.result.current.run(1000));
  await caseB.waitForNextUpdate();

  act(() => caseC.result.current.run(1000));
  await caseC.waitForNextUpdate();

  act(() => caseD.result.current.run(1000));
  await caseD.waitForNextUpdate();

  act(() => caseB.result.current.run());
  await caseB.waitForNextUpdate();

  act(() => caseC.result.current.run());
  await caseC.waitForNextUpdate();

  act(() => caseD.result.current.run());
  await caseD.waitForNextUpdate();
});

test('basic', async () => {
  const onStart = jest.fn();
  const onSuccess = jest.fn();
  const onFailure = jest.fn();

  function useTest() {
    const [page, setPage] = useState(0);
    const request = useCallback(() => requestWithParam(page), [page]);
    const next = useCallback(() => setPage(page => page + 1), []);
    const { data, ...reset } = useRxAsync(request, {
      onStart,
      onSuccess,
      onFailure,
    });
    return { data, next, ...reset };
  }

  const { result, waitForNextUpdate } = renderHook(() => useTest());

  expect(result.current.loading).toBe(true);
  expect(result.current.error).toBe(undefined);
  expect(onStart).toHaveBeenCalledTimes(1);
  expect(onSuccess).toHaveBeenCalledTimes(0);
  expect(onFailure).toHaveBeenCalledTimes(0);

  await waitForNextUpdate();

  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBe(undefined);
  expect(result.current.data).toBe(0);
  expect(onStart).toHaveBeenCalledTimes(1);
  expect(onSuccess).toHaveBeenCalledTimes(1);
  expect(onFailure).toHaveBeenCalledTimes(0);

  act(() => result.current.next());

  expect(result.current.loading).toBe(true);
  expect(onStart).toHaveBeenCalledTimes(2);
  expect(onSuccess).toHaveBeenCalledTimes(1);
  expect(onFailure).toHaveBeenCalledTimes(0);

  await waitForNextUpdate();

  expect(result.current.loading).toBe(false);
  expect(result.current.data).toBe(1);
  expect(onStart).toHaveBeenCalledTimes(2);
  expect(onSuccess).toHaveBeenCalledTimes(2);
  expect(onFailure).toHaveBeenCalledTimes(0);

  act(() => result.current.next());
  act(() => result.current.next());
  act(() => result.current.next());

  expect(onStart).toHaveBeenCalledTimes(5);
  expect(onSuccess).toHaveBeenCalledTimes(2);
  expect(onFailure).toHaveBeenCalledTimes(0);

  await waitForNextUpdate();

  expect(result.current.data).toBe(4);
  expect(onSuccess).toHaveBeenCalledTimes(3);
  expect(onFailure).toHaveBeenCalledTimes(0);
});

test('state should reset before subscribe', async () => {
  function useShouldCleanUp() {
    const [flag, setFlag] = useState(0);
    const onSuccess = useCallback(() => flag, [flag]);
    const state = useRxAsync(request, {
      defer: true,
      initialValue: 0,
      onSuccess,
    });

    return { ...state, setFlag };
  }

  const { result } = renderHook(() => useShouldCleanUp());

  act(() => {
    result.current.run();
  });

  expect(result.current.data).toBe(0);
  expect(result.current.loading).toBe(true);

  act(() => {
    result.current.setFlag(curr => curr + 1);
  });

  expect(result.current.data).toBe(0);
  expect(result.current.loading).toBe(false);
});

test('defer', async () => {
  const { result, waitForNextUpdate } = renderHook(() =>
    useRxAsync(request, { defer: true })
  );

  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBe(undefined);
  expect(result.current.data).toBe(undefined);

  act(() => {
    result.current.run();
  });

  await waitForNextUpdate();

  expect(result.current.data).toBe(1);
});

test('cancellation', async () => {
  const onStart = jest.fn();
  const onSuccess = jest.fn();
  const onFailure = jest.fn();
  const { result, waitForNextUpdate } = renderHook(() =>
    useRxAsync(request, { onStart, onSuccess, onFailure })
  );

  expect(result.current.data).toBe(undefined);

  act(() => {
    result.current.cancel();
  });

  expect(result.current.loading).toBe(false);
  expect(result.current.data).toBe(undefined);
  expect(onStart).toHaveBeenCalledTimes(1);
  expect(onSuccess).toHaveBeenCalledTimes(0);
  expect(onFailure).toHaveBeenCalledTimes(0);

  act(() => {
    result.current.run();
  });

  expect(result.current.loading).toBe(true);
  expect(onStart).toHaveBeenCalledTimes(2);
  expect(onSuccess).toHaveBeenCalledTimes(0);
  expect(onFailure).toHaveBeenCalledTimes(0);

  await waitForNextUpdate();

  expect(result.current.data).toBe(1);
  expect(onStart).toHaveBeenCalledTimes(2);
  expect(onSuccess).toHaveBeenCalledTimes(1);
  expect(onFailure).toHaveBeenCalledTimes(0);

  act(() => {
    result.current.run();
    result.current.cancel();
  });

  // After request cancelled, data should be same as before
  expect(result.current.loading).toBe(false);
  expect(result.current.data).toBe(1);
  expect(onStart).toHaveBeenCalledTimes(3);
  expect(onSuccess).toHaveBeenCalledTimes(1);
  expect(onFailure).toHaveBeenCalledTimes(0);
});

test('reset', async () => {
  const onStart = jest.fn();
  const onSuccess = jest.fn();
  const onFailure = jest.fn();
  const { result } = renderHook(() => useRxAsync(request, { initialValue: 0 }));

  act(() => {
    result.current.reset();
  });

  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBe(undefined);
  expect(result.current.data).toBe(0);
  expect(onStart).toHaveBeenCalledTimes(0);
  expect(onSuccess).toHaveBeenCalledTimes(0);
  expect(onFailure).toHaveBeenCalledTimes(0);

  act(() => {
    result.current.run();
  });

  act(() => {
    result.current.reset();
  });

  expect(onStart).toHaveBeenCalledTimes(0);
  expect(onSuccess).toHaveBeenCalledTimes(0);
  expect(onFailure).toHaveBeenCalledTimes(0);
});

test('error', async () => {
  const onStart = jest.fn();
  const onSuccess = jest.fn();
  const onFailure = jest.fn();
  const { result, waitForNextUpdate } = renderHook(() =>
    useRxAsync(errorReqest, {
      onStart,
      onSuccess,
      onFailure,
      mapOperator: mergeMap,
    })
  );

  await waitForNextUpdate();

  expect(result.current.error).toBe('error');
  expect(result.current.loading).toBe(false);
  expect(result.current.data).toBe(undefined);
  expect(onSuccess).toHaveBeenCalledTimes(0);
  expect(onFailure).toHaveBeenCalledTimes(1);

  act(() => result.current.run());
  act(() => result.current.run());
  act(() => result.current.run());

  expect(onFailure).toHaveBeenCalledTimes(1);
});
