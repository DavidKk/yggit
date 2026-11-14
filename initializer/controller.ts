import { packApiRouteResult, packApiRouteThrown } from '@/initializer/response'
import type { ApiRouteHandler, ApiRouteHandlerResult, DefaultRouteContext, ExistingRouteHandler } from '@/initializer/types'

export type { ApiRouteHandler, ApiRouteHandlerResult, DefaultRouteContext, ExistingRouteHandler } from '@/initializer/types'

export function defineApiRoute<TContext = DefaultRouteContext>(_policyId: string, handler: ApiRouteHandler<TContext>): ExistingRouteHandler<TContext> {
  return async (request, context) => {
    try {
      const result: ApiRouteHandlerResult = await handler({ request, context })
      return packApiRouteResult(result)
    } catch (error) {
      return packApiRouteThrown(error)
    }
  }
}
