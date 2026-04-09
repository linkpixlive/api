declare module 'cpf-cnpj-validator' {
  export const cpf: {
    isValid(cpf: string, strip?: boolean): boolean;
    format(cpf: string): string;
    generate(formatted?: boolean): string;
    strip(cpf: string): string;
  };

  export const cnpj: {
    isValid(cnpj: string, strip?: boolean): boolean;
    format(cnpj: string): string;
    generate(formatted?: boolean): string;
    strip(cnpj: string): string;
  };
}
