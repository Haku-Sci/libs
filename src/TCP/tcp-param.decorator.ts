export const TCP_PARAM_METADATA_KEY = 'tcp:param';

export function TcpParam(name: string): ParameterDecorator {
    return (target, propertyKey, parameterIndex) => {
        const existing: Array<{ index: number; name: string }> =
            Reflect.getMetadata(TCP_PARAM_METADATA_KEY, target, propertyKey) ?? [];
        existing.push({ index: parameterIndex, name });
        Reflect.defineMetadata(TCP_PARAM_METADATA_KEY, existing, target, propertyKey);
    };
}
