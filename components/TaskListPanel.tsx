// FIX: Implemented file content to resolve build errors.
import React, { useState } from 'react';
import { Task } from '../types';
import { TaskListIcon, ChevronDownIcon } from './icons/Icons';

interface TaskListPanelProps {
    tasks: Task[];
}

const TaskListPanel: React.FC<TaskListPanelProps> = ({ tasks }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!tasks || tasks.length === 0) {
        return null;
    }
    
    return (
        <div className="border-l-4 border-yellow-400 bg-yellow-400/10 rounded-r-lg">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 text-left"
                aria-expanded={isExpanded}
            >
                <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 text-yellow-400 pt-0.5">
                        <TaskListIcon />
                    </div>
                    <div className="text-left">
                        <h3 className="font-semibold text-yellow-300">Task List</h3>
                        {!isExpanded && <p className="text-xs text-gray-500">{tasks.length} task{tasks.length !== 1 ? 's' : ''} generated</p>}
                    </div>
                </div>
                <ChevronDownIcon className={`w-5 h-5 text-yellow-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isExpanded && (
                <div className="px-4 pb-4">
                    <div className="pl-9">
                        <ul className="list-none mt-2 space-y-2">
                            {tasks.map((task) => (
                                <li key={task.id} className="flex items-center gap-2 text-sm text-gray-400">
                                    {/* FIX: Property 'completed' does not exist on type 'Task'. This component displays the agent's plan, so tasks are considered incomplete at this stage. */}
                                    <input type="checkbox" defaultChecked={false} className="form-checkbox h-4 w-4 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500" />
                                    <span>{task.description}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskListPanel;