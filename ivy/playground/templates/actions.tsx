// ivy imports
import { client } from '../core'
import { generateInputMap } from '../contracts/selectors'

// internal imports
import { INITIAL_ID_LIST } from './constants'
import { getSourceMap, hasSourceChanged } from './selectors'
import { CompilerResult, CompiledTemplate } from './types'
import { makeEmptyTemplate, formatCompilerResult } from './util'

export const loadTemplate = (selected: string) => {
  return (dispatch, getState) => {
    if (!selected) {
      selected = INITIAL_ID_LIST[1]
    }
    const state = getState()
    const source = getSourceMap(state)[selected]
    dispatch(setSource(source))
  }
}

export const SHOW_LOCK_INPUT_ERRORS = 'templates/SHOW_LOCK_INPUT_ERRORS'

export const showLockInputErrors = (result: boolean) => {
  return {
    type: SHOW_LOCK_INPUT_ERRORS,
    result
  }
}

export const UPDATE_LOCK_ERROR = 'templates/UPDATE_LOCK_ERROR'

export const updateLockError = (error?) => {
  return {
    type: UPDATE_LOCK_ERROR,
    error
  }
}

export const SET_SOURCE = 'templates/SET_SOURCE'

export const setSource = (source: string) => {
  return (dispatch, getState) => {
    const type = SET_SOURCE
    const sourceChanged = hasSourceChanged(source)(getState())
    dispatch({ type, source, sourceChanged })
    dispatch(fetchCompiled(source))
    dispatch(updateLockError())
  }
}

export const FETCH_COMPILED = 'templates/FETCH_COMPILED'

export const fetchCompiled = (source: string) => {
  return (dispatch, getState) => {
    const type = FETCH_COMPILED
    const importCheck = source.match(/\bcontract\b[\s\S]*\bimport\b/gm)
    if (importCheck !== null) {
      // An invalid import statement has been found.
      const errMsg = 'All import statements should appear before contract expression.'
      const compiled: CompiledTemplate = makeEmptyTemplate(source, errMsg)
      const inputMap = {}
      return dispatch({ type, compiled, inputMap })
    }

    const contractCheck = source.match(/\bcontract\b/gm)
    if (contractCheck && contractCheck.length > 1) {
      // Multiple contract expressions found.
      const errMsg = 'Only 1 contract expression allowed.'
      const compiled: CompiledTemplate = makeEmptyTemplate(source, errMsg)
      const inputMap = {}
      return dispatch({ type, compiled, inputMap })
    }

    const sourceMap = getSourceMap(getState())
    const transform = (source: string) => {
      return source.replace(/\bimport\b(.*)$/gm, (match, contractName) => sourceMap[contractName])
    }
    const transformed = transform(source)
    return client.ivy.compile({ source: transformed }).then((result: CompilerResult) => {
      if (result.error) {
        return makeEmptyTemplate(source, result.error)
      }

      const formatted: CompilerResult = formatCompilerResult(result)
      const compiled: CompiledTemplate = ({
        ...formatted.contracts[formatted.contracts.length-1],
        source,
        error: ''
      } as CompiledTemplate)

      let inputMap = {}
      if (compiled) {
        inputMap = generateInputMap(compiled)
      }
      return dispatch({ type, compiled, inputMap })
    }).catch((e) => {throw e})
  }
}

export const SAVE_TEMPLATE = 'templates/SAVE_TEMPLATE'

export const saveTemplate = () => ({ type: SAVE_TEMPLATE })
