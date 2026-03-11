import { NextResponse } from 'next/server';
import { getSearchData } from '@/lib/articles';

export async function GET() {
    try {
        const data = getSearchData();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching search data:', error);
        return NextResponse.json({ error: 'Failed to fetch search data' }, { status: 500 });
    }
}
