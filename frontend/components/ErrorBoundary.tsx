"use client"

import React, { Component, ErrorInfo, ReactNode } from "react"
import { AlertCircle, RefreshCw } from "lucide-react"

interface Props {
    children?: ReactNode
    fallback?: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    }

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo)
    }

    public reset = () => {
        this.setState({ hasError: false, error: null })
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            return (
                <div className="flex h-full min-h-[200px] w-full items-center justify-center rounded-lg border border-red-200 bg-red-50 p-6 text-red-900 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <AlertCircle className="h-10 w-10 text-red-500" />
                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold">Something went wrong</h3>
                            <p className="text-sm opacity-90 max-w-[300px]">
                                {this.state.error?.message || "An unexpected error occurred."}
                            </p>
                        </div>
                        <button
                            onClick={this.reset}
                            className="flex items-center gap-2 rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-900 transition-colors hover:bg-red-200 dark:bg-red-900/40 dark:text-red-100 dark:hover:bg-red-900/60"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Try Again
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
