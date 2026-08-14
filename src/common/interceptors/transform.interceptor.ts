import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

/// Wraps every successful controller return value in a consistent envelope so
/// the React Native client can rely on one response shape.
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((payload: T | (ApiResponse<T> & { message?: string })) => {
        if (
          payload &&
          typeof payload === 'object' &&
          'success' in payload &&
          'data' in payload
        ) {
          return payload as ApiResponse<T>;
        }
        return { success: true as const, data: payload as T };
      }),
    );
  }
}
