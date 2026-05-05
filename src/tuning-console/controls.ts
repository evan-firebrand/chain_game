// DOM widget factories for the Tuning Console. No game-session imports —
// the console wires these up to session calls.

export interface SliderControl {
  readonly element: HTMLElement;
  setValue(value: number): void;
  getValue(): number;
  onChange(handler: (value: number) => void): void;
}

export interface NumberControl {
  readonly element: HTMLElement;
  setValue(value: number): void;
  getValue(): number;
  onChange(handler: (value: number) => void): void;
}

export interface SliderOpts {
  readonly id: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  /** Optional suffix shown next to the readout, e.g. "%". */
  readonly readoutSuffix?: string;
}

export function makeSlider(opts: SliderOpts): SliderControl {
  const wrap = document.createElement('label');
  wrap.className = 'tc-slider';
  wrap.htmlFor = opts.id;

  const labelRow = document.createElement('div');
  labelRow.className = 'tc-slider-row';
  const labelEl = document.createElement('span');
  labelEl.className = 'tc-slider-label';
  labelEl.textContent = opts.label;
  const readoutEl = document.createElement('span');
  readoutEl.className = 'tc-slider-readout';
  readoutEl.textContent = String(opts.value) + (opts.readoutSuffix ?? '');
  labelRow.appendChild(labelEl);
  labelRow.appendChild(readoutEl);

  const input = document.createElement('input');
  input.type = 'range';
  input.id = opts.id;
  input.min = String(opts.min);
  input.max = String(opts.max);
  input.step = String(opts.step);
  input.value = String(opts.value);

  wrap.appendChild(labelRow);
  wrap.appendChild(input);

  let handler: ((value: number) => void) | null = null;
  input.addEventListener('input', () => {
    const v = Number(input.value);
    readoutEl.textContent = String(v) + (opts.readoutSuffix ?? '');
    if (handler !== null) handler(v);
  });

  return {
    element: wrap,
    setValue(value: number): void {
      input.value = String(value);
      readoutEl.textContent = String(value) + (opts.readoutSuffix ?? '');
    },
    getValue(): number {
      return Number(input.value);
    },
    onChange(h: (value: number) => void): void {
      handler = h;
    },
  };
}

export interface NumberOpts {
  readonly id: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
}

export function makeNumberInput(opts: NumberOpts): NumberControl {
  const wrap = document.createElement('label');
  wrap.className = 'tc-number';
  wrap.htmlFor = opts.id;

  const labelEl = document.createElement('span');
  labelEl.className = 'tc-number-label';
  labelEl.textContent = opts.label;

  const input = document.createElement('input');
  input.type = 'number';
  input.id = opts.id;
  input.min = String(opts.min);
  input.max = String(opts.max);
  input.step = String(opts.step);
  input.value = String(opts.value);

  wrap.appendChild(labelEl);
  wrap.appendChild(input);

  let handler: ((value: number) => void) | null = null;
  input.addEventListener('change', () => {
    const v = Number(input.value);
    if (handler !== null) handler(v);
  });

  return {
    element: wrap,
    setValue(value: number): void {
      input.value = String(value);
    },
    getValue(): number {
      return Number(input.value);
    },
    onChange(h: (value: number) => void): void {
      handler = h;
    },
  };
}

export function makeButton(label: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tc-button';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}
