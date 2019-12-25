## useRxAsync

Fetch data with react hooks and rxjs. Inspired by [react-async](https://github.com/async-library/react-async)

```js
const state = useRxAsync(asyncFn, options?);
```

## State

| name    | description                                     |
| ------- | ----------------------------------------------- |
| data    | The value return from asyncFn                   |
| loading | boolean                                         |
| error   | any, depends on your asyncFn                    |
| cancel  | ignore the new value return from your `asyncFn` |
| reset   | reset data, loading, error to initialValue      |

## AsyncFn

A function that return `PromiseLike` or `Observable`. For examples,

```ts
const delay = (ms: number) => new Promise(_ => setTimeout(_, ms));
const rxAsyncFn = (result: string) => timer(1000).pipe(map(() => result));
```

## Options

| option       | description                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| initialValue | set the initial value of your `asyncFn`                                                                                                          |
| defer        | by default, your `asyncFn` will be call at initial or it changed. if you set `defer` to true, it will only run when you execute the `run` mehtod |
| onStart      | callback when `asyncFn` start, () => void                                                                                                        |
| onSuccess    | callback when `asyncFn` success, (result) => void                                                                                                |
| onFaulure    | callback when `asyncFn` failure, (error: any) => void                                                                                            |
| mapOperator  | switchMap, concatMap , exhaustMap , mergeMap , flatMap, default is switchMap                                                                     |

## Recipes

```ts
const delay = (ms: number) => new Promise(_ => setTimeout(_, ms));
```

### Basic

Examples

- [Basic](https://stackblitz.com/edit/use-rx-async-basic)
- [Observable](https://stackblitz.com/edit/use-rx-async-observable)

```js
import { useRxAsync } from 'use-rx-async';

function Component() {
  const { data, loading, error, cancel, reset } = useRxAsync(asyncFn);

  if (loading) {
    return 'loading...';
  }

  if (error) {
    return 'error!';
  }

  return data;
}
```

### AsyncFn with dynamic parameters

Examples

- [Search github user repo](https://stackblitz.com/edit/use-rx-async-dynamic)

```ts
const asyncFnWithParam = (result: string) => delay(1000).then(() => result);

// wrap your default asyncFn with useCallback
function useHooks() {
  const [result, setResult] = useState<string>();
  const asyncFn = useCallback(() => {
    return typeof result === 'string'
      ? asyncFnWithParam(result)
      : Promise.reject();
  }, [result]);
  const { loading, data } = useRxAsync(asyncFn);

  useEffect(() => {
    setResult('Hello world');
  }, []);
}

// Or set `defer` to true, if the asyncFn has parameters, you cannot set defer to false / undefined.
function useHooks() {
  const { run } = useRxAsync(asyncFnWithParam, { defer: true });
  useEffect(() => {
    run('Hello World');
  }, [run]);
}
```

### With RxJS operators

```ts
import { timer } from 'rxjs';
import { delayWhen, retryWhen, take } from 'rxjs/operators';

const yourApiRequest = () => fetch('/api').then(res => res.json());

// if the request has errors, delay 1 second then retry up to 3 times
const asyncFn = () =>
  from(yourApiRequest()).pipe(
    retryWhen(errors =>
      errors.pipe(
        switchMap((error, index) =>
          index === 3 ? throwError(error) : of(error)
        ),
        delayWhen(() => timer(1000))
      )
    )
  );

function Component() {
  const state = useRxAsync(asyncFn);
  
  // ....
}
```

### With initial value

```tsx
const { data } = useRxAsync(apiRequest, {
  initialValue: [],
});

// or

const { data = [] } = useRxAsync(apiRequest);
```

## Caching

if you are axios user, you could use [kuitos/axios-extensions](https://github.com/kuitos/axios-extensions)
