import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Search } from 'lucide-react';

const PositionsGrid = () => {
    // Mock positions data - in real app would come from API
    const initialPositions = [
        {
            symbol: 'AAPL',
            quantity: 1500,
            avgPrice: 182.45,
            currentPrice: 188.32,
            pnl: 8805,
            pnlPercent: 3.21,
            marketValue: 282480,
            sector: 'Technology'
        },
        {
            symbol: 'MSFT',
            quantity: 800,
            avgPrice: 337.89,
            currentPrice: 345.67,
            pnl: 6224,
            pnlPercent: 2.30,
            marketValue: 276536,
            sector: 'Technology'
        },
        {
            symbol: 'JPM',
            quantity: -500,
            avgPrice: 172.34,
            currentPrice: 169.45,
            pnl: 1445,
            pnlPercent: 1.68,
            marketValue: -84725,
            sector: 'Financials'
        }
    ];

    const [positions, setPositions] = useState(initialPositions);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({
        key: null,
        direction: 'ascending'
    });

    const handleSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });

        const sortedPositions = [...positions].sort((a, b) => {
            if (a[key] < b[key]) return direction === 'ascending' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'ascending' ? 1 : -1;
            return 0;
        });

        setPositions(sortedPositions);
    };

    const filteredPositions = positions.filter(position =>
        position.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        position.sector.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatNumber = (num) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    };

    return (
        <div className="w-full bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Positions</h2>
                <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search symbol or sector..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 p-2 border rounded-md w-64"
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full table-auto">
                    <thead>
                        <tr className="bg-gray-50">
                            <th
                                className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('symbol')}
                            >
                                Symbol
                                {sortConfig.key === 'symbol' && (
                                    sortConfig.direction === 'ascending' ? <ArrowUp className="inline ml-1 h-4 w-4" /> : <ArrowDown className="inline ml-1 h-4 w-4" />
                                )}
                            </th>
                            <th className="px-4 py-2 text-right">Position</th>
                            <th className="px-4 py-2 text-right">Avg Price</th>
                            <th className="px-4 py-2 text-right">Current Price</th>
                            <th
                                className="px-4 py-2 text-right cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('pnl')}
                            >
                                P&L
                                {sortConfig.key === 'pnl' && (
                                    sortConfig.direction === 'ascending' ? <ArrowUp className="inline ml-1 h-4 w-4" /> : <ArrowDown className="inline ml-1 h-4 w-4" />
                                )}
                            </th>
                            <th className="px-4 py-2 text-right">P&L %</th>
                            <th className="px-4 py-2 text-right">Market Value</th>
                            <th className="px-4 py-2 text-left">Sector</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPositions.map((position, index) => (
                            <tr
                                key={position.symbol}
                                className={`
                  ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                  hover:bg-blue-50
                `}
                            >
                                <td className="px-4 py-2 font-medium">{position.symbol}</td>
                                <td className={`px-4 py-2 text-right ${position.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {position.quantity.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-right">{formatNumber(position.avgPrice)}</td>
                                <td className="px-4 py-2 text-right">{formatNumber(position.currentPrice)}</td>
                                <td className={`px-4 py-2 text-right font-medium ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatNumber(position.pnl)}
                                </td>
                                <td className={`px-4 py-2 text-right ${position.pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatNumber(position.pnlPercent)}%
                                </td>
                                <td className="px-4 py-2 text-right">{formatNumber(position.marketValue)}</td>
                                <td className="px-4 py-2">{position.sector}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 flex justify-between text-sm text-gray-600">
                <span>Total Positions: {filteredPositions.length}</span>
                <span>Total Market Value: {formatNumber(filteredPositions.reduce((sum, pos) => sum + pos.marketValue, 0))}</span>
            </div>
        </div>
    );
};

export default PositionsGrid;