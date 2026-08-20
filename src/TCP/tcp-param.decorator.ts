export const TCP_PARAM_METADATA_KEY = 'tcp:param';
export const TCP_SENDER_METADATA_KEY = 'tcp:sender';

export function TcpParam(name: string): ParameterDecorator {
    return (target, propertyKey, parameterIndex) => {
        const existing: Array<{ index: number; name: string }> =
            Reflect.getMetadata(TCP_PARAM_METADATA_KEY, target, propertyKey) ?? [];
        existing.push({ index: parameterIndex, name });
        Reflect.defineMetadata(TCP_PARAM_METADATA_KEY, existing, target, propertyKey);
    };
}

export function TcpSender(): ParameterDecorator {
    return (target, propertyKey, parameterIndex) => {
        Reflect.defineMetadata(TCP_SENDER_METADATA_KEY, parameterIndex, target, propertyKey);
    };
}
