type LowerToUpperToLowerCaseMapper = {
  a: 'A';
  b: 'B';
  c: 'C';
  d: 'D';
  e: 'E';
  f: 'F';
  g: 'G';
  h: 'H';
  i: 'I';
  j: 'J';
  k: 'K';
  l: 'L';
  m: 'M';
  n: 'N';
  o: 'O';
  p: 'P';
  q: 'Q';
  r: 'R';
  s: 'S';
  t: 'T';
  u: 'U';
  v: 'V';
  w: 'W';
  x: 'X';
  y: 'Y';
  z: 'Z';
};

type UpperToLowerCaseMapper = {
  A: 'a';
  B: 'b';
  C: 'c';
  D: 'd';
  E: 'e';
  F: 'f';
  G: 'g';
  H: 'h';
  I: 'i';
  J: 'j';
  K: 'k';
  L: 'l';
  M: 'm';
  N: 'n';
  O: 'o';
  P: 'p';
  Q: 'q';
  R: 'r';
  S: 's';
  T: 't';
  U: 'u';
  V: 'v';
  W: 'w';
  X: 'x';
  Y: 'y';
  Z: 'z';
};

type HeadLetter<T> = T extends `${infer FirstLetter}${infer _Rest}`
  ? FirstLetter
  : never;
type TailLetters<T> = T extends `${infer _FirstLetter}${infer Rest}`
  ? Rest
  : never;

type ToCfnCase<T> = T extends ''
  ? T
  : `${LetterToUpper<HeadLetter<T>>}${TailLetters<T>}`;

type LetterToUpper<T> = T extends `${infer FirstLetter}${infer _Rest}`
  ? FirstLetter extends keyof LowerToUpperToLowerCaseMapper
    ? LowerToUpperToLowerCaseMapper[FirstLetter]
    : FirstLetter
  : T;

// apply snake case into objects
type Cast<T, U> = T extends U ? T : U;
type GetObjValues<T> = T extends Record<any, infer V> ? V : never;

type CallRecursiveTransformIfObj<T> = T extends Record<any, any>
  ? TransformKeysToCfnCase<T>
  : T;

export type SwitchKeyValue<
  T,
  T1 extends Record<string, any> = {
    [K in keyof T]: { key: K; value: T[K] };
  },
  T2 = {
    [K in GetObjValues<T1>['value']]: Extract<
      GetObjValues<T1>,
      { value: K }
    >['key'];
  },
> = T2;

export type TransformKeysToCfnCase<
  T extends Record<string, any>,
  T0 = { [K in keyof T]: ToCfnCase<K> },
  T1 = SwitchKeyValue<T0>,
  T2 = { [K in keyof T1]: CallRecursiveTransformIfObj<T[Cast<T1[K], string>]> },
> = T2;
